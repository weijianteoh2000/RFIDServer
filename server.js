const express = require('express');
const { ethers } = require('ethers');
const path = require('path');
const app = express();
const port = 3048; // You can change the port if needed

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Constants and configurations
const logicContractAddress = '0xD01f74BBB6d9c22dd1a75578F40EaD24EF4C3945';
const proxyAdminAddress = '0xc4CE25Ec54c1dBED2255a262f0D09cA565D11D54';
const RFIDStatuses = {
    Pending: 0,
    Available: 1,
    Unavailable: 2,
    Deleted: 3
};
const TransparentProxyContract = require(path.join(__dirname, '', 'transparentProxy.json'));
const { abi: TransparentProxyABI, bytecode: TransparentProxyBytecode } = TransparentProxyContract;

// Load ABI and Bytecode from JSON file
const RFIDV1 = require(path.join(__dirname, '', 'itemContractV1.json'));
const { abi: contractV1ABI, bytecode: contractV1Bytecode } = RFIDV1;

// Provider URL pointing to a local Ethereum node
const PROVIDER_URL = 'http://localhost:8545';

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
  try {
    const signer = await getSigner();
    const statusValue = RFIDStatuses[newStatus];

    if (statusValue === undefined) {
      console.error('Invalid RFID status:', newStatus);
      throw new Error('Invalid RFID status');
    }

    // ABI of the logic contract for encoding the initialization data
    const logicContract = new ethers.Contract(logicContractAddress, contractV1ABI, signer);
    const initData = logicContract.interface.encodeFunctionData('initialize', [itemId, itemName, itemLocation, createdBy, statusValue]);
    console.log('initData:', initData);

    // Deploy the TransparentUpgradeableProxy
    const TransparentProxyFactory = new ethers.ContractFactory(TransparentProxyABI, TransparentProxyBytecode, signer);

    const proxy = await TransparentProxyFactory.deploy(logicContractAddress, proxyAdminAddress, initData);
    await proxy.waitForDeployment();
    const address = proxy.address;
    console.log(`Proxy deployed at: ${address}`);
    console.log(`Transaction Hash: ${proxy.deploymentTransaction()}`);

    return {
      logicContractAddress: logicContractAddress,
      contractAddress: address,
    };
  } catch (error) {
    console.error('Error deploying contract:', error);
    throw error;
  }
};

// Update Location Function
const updateLocation = async (contractAddress, newLocation, updatedBy) => {
  try {
    const signer = await getSigner();
    const contract = new ethers.Contract(contractAddress, contractV1ABI, signer);
    const txResponse = await contract.updateLocation(newLocation, updatedBy);
    await txResponse.wait();
    console.log('Location updated');
    return { message: 'Location updated successfully' };
  } catch (error) {
    console.error('Update location failed:', error);
    throw error;
  }
};

// Change RFID Status Function
const changeRFIDStatus = async (contractAddress, newStatus, updatedBy) => {
  if (!contractAddress || !newStatus) {
    console.error('Invalid or missing parameters');
    throw new Error('Invalid or missing parameters');
  }

  try {
    const signer = await getSigner();
    const contract = new ethers.Contract(contractAddress, contractV1ABI, signer);
    const statusValue = RFIDStatuses[newStatus];

    if (statusValue === undefined) {
      console.error('Invalid RFID status:', newStatus);
      throw new Error('Invalid RFID status');
    }

    const txResponse = await contract.changeRFIDStatus(statusValue, updatedBy);
    await txResponse.wait();
    console.log('RFID status updated');
    return { message: 'RFID status updated successfully' };
  } catch (error) {
    console.error('RFID status update failed:', error);
    throw error;
  }
};

// Define the /hi route
app.get('/hi', (req, res) => {
  res.json({ message: 'hi' });
});

// Define the /hw route
app.get('/hw', (req, res) => {
  res.json({ message: 'hello world' });
});

// Define the /create route for deploying a contract
app.post('/create', async (req, res) => {
  // const { itemId, itemName, itemLocation, createdBy, newStatus } = req.body;

  // if (!itemId || !itemName || !itemLocation || !createdBy || !newStatus) {
  //   return res.status(400).json({ error: 'Missing required fields' });
  // }
  console.log('Creating contract with:', itemId, itemName, itemLocation, createdBy, newStatus);
  try {
    //const result = await deployContract(itemId, itemName, itemLocation, createdBy, newStatus);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Define the /update-location route for updating the location
app.post('/update-location', async (req, res) => {
  const { contractAddress, newLocation, updatedBy } = req.body;

  if (!contractAddress || !newLocation || !updatedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await updateLocation(contractAddress, newLocation, updatedBy);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Define the /change-status route for changing the RFID status
app.post('/change-status', async (req, res) => {
  const { contractAddress, newStatus, updatedBy } = req.body;

  if (!contractAddress || !newStatus || !updatedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await changeRFIDStatus(contractAddress, newStatus, updatedBy);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
