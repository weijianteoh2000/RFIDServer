var express = require('express');
const { ethers } = require('ethers');
const path = require('path');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// Constants and configurations
const RFIDStatuses = {
  Pending: 0,
  Available: 1,
  Unavailable: 2,
  Deleted: 3
};

// Load ABI and Bytecode from JSON file
const RFIDV1 = require(path.join(__dirname, '', '../contract/itemContractV1.json'));
const { abi: contractV1ABI, bytecode: contractV1Bytecode } = RFIDV1;

// Provider URL pointing to a local Ethereum node
const PROVIDER_URL = 'http://4.194.242.43:8545/';

// Replace this private key with the one you want to use
const PRIVATE_KEY = 'ba87d09cd4c9b24fb087376bf40fc46f3fbc139e6cd6c066740787f519e57d29';

// Initialize provider
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// Initialize wallet with the private key and connect it to the provider
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

async function getSigner() {
  return wallet; // The wallet itself acts as the signer
}

// Deploy Contract Function
const deployContract = async (itemId, itemName, itemLocation, createdBy, newStatus) => {
  const signer = await getSigner();
  const factory = new ethers.ContractFactory(contractV1ABI, contractV1Bytecode, signer);
  const statusValue = RFIDStatuses[newStatus];

  if (statusValue === undefined) {
    console.error('Invalid RFID status:', newStatus);
    return;
  }

  try {
    const contract = await factory.deploy(itemId, itemName, itemLocation, createdBy, statusValue);
    await contract.waitForDeployment();
    const transactionHash = contract.deploymentTransaction().hash;
    console.log(`Transaction details: ${transactionHash}`);
    const address = await contract.getAddress();
    console.log(`Contract deployed at address: ${address}`);
    return {
      contractAddress: address,
      transactionId: transactionHash
    };
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
};

// Update Location Function
const updateLocation = async (contractAddress, newLocation, updatedBy) => {
  const signer = await getSigner();
  const contract = new ethers.Contract(contractAddress, contractV1ABI, signer);

  try {
    const txResponse = await contract.updateLocation(newLocation, updatedBy.getAddress());
    await txResponse.wait();
    console.log('Location updated');
  } catch (error) {
    console.error('Update location failed:', error);
    throw error;
  }
};

// Change RFID Status Function
const changeRFIDStatus = async (contractAddress, newStatus, updatedBy) => {
  if (!contractAddress || !newStatus) {
    console.error('Invalid or missing parameters');
    return Promise.reject('Invalid or missing parameters');
  }

  try {
    const signer = await getSigner();
    const contract = new ethers.Contract(contractAddress, contractV1ABI, signer);
    const statusValue = RFIDStatuses[newStatus];

    if (statusValue === undefined) {
      console.error('Invalid RFID status:', newStatus);
      return Promise.reject('Invalid RFID status');
    }

    const txResponse = await contract.changeRFIDStatus(statusValue, updatedBy.getAddress());
    await txResponse.wait();
    console.log('RFID status updated');
    return Promise.resolve(); // Explicitly return a resolved promise
  } catch (error) {
    console.error('RFID status update failed:', error);
    return Promise.reject(error); // Explicitly return a rejected promise
  }
};

// Define the /hi route
router.get('/hi', (req, res) => {
  res.json({ message: 'hi' });
});

// Define the /hw route
router.get('/hw', (req, res) => {
  res.json({ message: 'hello world' });
});

// // Define the /create route for deploying a contract
// router.get('/create', async (req, res) => {
//   // const { itemId, itemName, itemLocation, createdBy, newStatus } = req.body;
//   console.log(req.body);
//   // const { itemId } = req.body;
//   itemId = "123456";
//   itemName = "Test Item";
//   itemLocation = "Test Location";
//   createdBy = "Test User";
//   newStatus = "Unavailable";

//   // if (!itemId || !itemName || !itemLocation || !createdBy || !newStatus) {
//   //   return res.status(400).json({ error: 'Missing required fields' });
//   // }
//   console.log('Creating contract with:', itemId, itemName, itemLocation, createdBy, newStatus);
//   try {
//     const result = await deployContract(itemId, itemName, itemLocation, createdBy, newStatus);
//     res.status(200).json({ message: result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// Define the /update-location route for updating the location
router.post('/update-location', async (req, res) => {
  const { contractAddress, newLocation } = req.body;

  // const contractAddress = "0xc3BB9911e90BEF2a7502e20938bf440435fe6aD5";
  // const newLocation = "Room B";
  const updatedBy = await getSigner();

  if (!contractAddress || !newLocation || !updatedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await updateLocation(contractAddress, newLocation, updatedBy);
    res.status(200).json({ message: 'Location updated' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

// Define the /change-status route for changing the RFID status
router.post('/change-status', async (req, res) => {
  const { contractAddress, newStatus } = req.body;
  // const contractAddress = "0xc3BB9911e90BEF2a7502e20938bf440435fe6aD5";
  // const newStatus = "Available";
  const updatedBy = await getSigner();

  if (!contractAddress || !newStatus || !updatedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await changeRFIDStatus(contractAddress, newStatus, updatedBy);
    res.status(200).json({ message: 'RFID status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
