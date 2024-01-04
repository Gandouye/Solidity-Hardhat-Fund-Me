const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("FundMe", async function () {
      let fundMe;
      let deployer;
      let MockV3Aggregator;
      const sendValue = "10000000000000000000"; // ethers.parseEther("1");  1 ETH

      beforeEach(async function () {
        //deploy our contract using hardhat
        //const accounts = await ethers.getSigners();
        //const account0 = accounts[0];
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        fundMe = await ethers.getContract("FundMe", deployer);
        MockV3Aggregator = await ethers.getContract(
          "MockV3Aggregator",
          deployer
        );
      });

      describe("conctructor", async function () {
        it("Is the aggregator address set correctly", async () => {
          const response = await fundMe.getPriceFeed();
          assert.equal(response, MockV3Aggregator.target);
        });
      });

      describe("fund", async () => {
        it("Fails if we do not send enough ETH", async () => {
          //the transaction should fail and this is what we are tracking
          await expect(fundMe.fund()).to.be.revertedWith(
            "You need to spend more ETH!"
          );
        });

        it("Update ammount funded data structure", async () => {
          console.log("fundMe " + fundMe);
          await fundMe.fund({ value: sendValue });
          console.log("deployer " + deployer);
          let response2 = await fundMe.getAddressToAmountFunded(deployer);
          console.log("response " + response2);
          console.log("sendValue " + sendValue);
          assert.equal(response2.toString(), sendValue.toString());
        });

        it("add funder to array of funders", async () => {
          await fundMe.fund({ value: sendValue });
          const funder = await fundMe.getFunder(0);
          assert.equal(funder, deployer);
        });
      });

      describe("withdraw", async () => {
        beforeEach(async () => {
          await fundMe.fund({ value: sendValue });
        });

        it("withdraw ETH from a single funder", async () => {
          //arrange
          console.log("fundme.provider " + fundMe.provider);
          const startingFundMeBalance = await ethers.provider.getBalance(
            fundMe.target
          );
          const startingDeployerBalance = await ethers.provider.getBalance(
            deployer
          );

          //act
          const transactionResponse = await fundMe.withdraw();
          const transactionReceipt = await transactionResponse.wait(1);
          //const gasUsed = transactionReceipt.gasUsed;
          //const gasPrice = transactionReceipt.gasPrice;
          const { gasPrice, gasUsed } = transactionReceipt;
          const gasCost = gasUsed * gasPrice;
          const endingFundMeBalance = await ethers.provider.getBalance(
            fundMe.target
          );
          const endingDeployerBalance = await ethers.provider.getBalance(
            deployer
          );

          // gascost

          //assert
          assert.equal(endingFundMeBalance, 0);
          //.add because of bigNumber type
          assert.equal(
            (startingFundMeBalance + startingDeployerBalance).toString(),
            (endingDeployerBalance + gasCost).toString()
          );
        });

        it("Allow us to withdraw with multiple funders", async () => {
          //Arrange section
          const accounts = await ethers.getSigners();
          for (let i = 1; i < 6; i++) {
            const fundMeConnectedContract = await fundMe.connect(accounts[i]);
            await fundMeConnectedContract.fund({ value: sendValue });
          }
          const startingFundMeBalance = await ethers.provider.getBalance(
            fundMe.target
          );
          const startingDeployerBalance = await ethers.provider.getBalance(
            deployer
          );

          //act
          const transactionResponse = await fundMe.withdraw();
          const transactionReceipt = await transactionResponse.wait(1);
          const { gasPrice, gasUsed } = transactionReceipt;
          const gasCost = gasUsed * gasPrice;
          const endingFundMeBalance = await ethers.provider.getBalance(
            fundMe.target
          );
          const endingDeployerBalance = await ethers.provider.getBalance(
            deployer
          );

          //assert
          assert.equal(endingFundMeBalance, 0);
          //.add because of bigNumber type
          assert.equal(
            (startingFundMeBalance + startingDeployerBalance).toString(),
            (endingDeployerBalance + gasCost).toString()
          );

          //Make sure that funders are reset properly
          await expect(fundMe.getFunder(0)).to.be.reverted;
          for (i = 1; i < 6; i++) {
            assert.equal(
              await fundMe.getAddressToAmountFunded(accounts[i].address),
              0
            );
          }
        });

        it("Only allow owner to withdraw", async () => {
          const accounts = await ethers.getSigners();
          const attacker = accounts[5];
          const attackerConnectedContract = await fundMe.connect(attacker);
          await expect(
            attackerConnectedContract.withdraw()
          ).to.be.revertedWithCustomError(fundMe, "FundMe__NotOwner");
        });
      });
    });
