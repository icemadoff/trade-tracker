const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const persistentPath = '/swinging';
const openTradesFolder = path.join(persistentPath, 'openpos');
const closedTradesFolder = path.join(persistentPath, 'closedpos');

[openTradesFolder, closedTradesFolder].forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log(`Created directory: ${folder}`);
  }
});

// Parse JSON bodies
app.use(express.json());

// POST endpoint to add a new trade (open trade)
app.post('/add-trade', (req, res) => {
  const trade = req.body;
  if (!trade.ticker || !trade.entry || !trade.tp || !trade.sl || !trade.size) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Ensure ticker is uppercase and ends with USD
  let ticker = trade.ticker.toUpperCase();
  if (!ticker.endsWith("USD")) {
    ticker += "USD";
  }
  trade.ticker = ticker;
  // Set current price initially to entry price
  trade.current = trade.entry;
  
  // Create filename: remove "USD" from ticker, then add current date/time in ISO format without punctuation
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, "");
  const filename = `${ticker.replace("USD", "")}_${timestamp}.txt`;
  const filepath = path.join(openTradesFolder, filename);
  
  // Build file content in the same format as your trade files
  const content =
    `Ticker: ${trade.ticker}\n` +
    `Entry Price: ${trade.entry}\n` +
    `Take Profit: ${trade.tp}\n` +
    `Stop Loss: ${trade.sl}\n` +
    `Position Size: ${trade.size}\n` +
    `Current Price: ${trade.current}\n`;
  
  fs.writeFile(filepath, content, 'utf8', err => {
    if (err) {
      console.error("Error writing trade file:", err);
      return res.status(500).json({ error: 'Failed to save trade file' });
    }
    return res.json({ message: 'Trade added', filename });
  });
});

// GET endpoint to load all open trades from the openpos folder
app.get('/open-trades', (req, res) => {
  fs.readdir(openTradesFolder, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading trades folder');
    }
    let trades = [];
    let pendingFiles = files.length;
    if (pendingFiles === 0) return res.json(trades);

    files.forEach(file => {
      if (file.endsWith('.txt')) {
        const filePath = path.join(openTradesFolder, file);
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (!err) {
            let trade = parseTradeFile(data);
            if (trade) {
              // Optionally, attach the filename so client can reference it
              trade.filename = file;
              trades.push(trade);
            }
          }
          pendingFiles--;
          if (pendingFiles === 0) {
            res.json(trades);
          }
        });
      } else {
        pendingFiles--;
        if (pendingFiles === 0) {
          res.json(trades);
        }
      }
    });
  });
});

// GET endpoint to load all closed trades from the closedpos folder
app.get('/closed-trades', (req, res) => {
  fs.readdir(closedTradesFolder, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading closed trades folder');
    }
    let trades = [];
    let pendingFiles = files.length;
    if (pendingFiles === 0) return res.json(trades);

    files.forEach(file => {
      if (file.endsWith('.txt')) {
        const filePath = path.join(closedTradesFolder, file);
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (!err) {
            let trade = parseClosedTradeFile(data);
            if (trade) {
              trade.filename = file; // Optional: include filename for reference
              trades.push(trade);
            }
          }
          pendingFiles--;
          if (pendingFiles === 0) {
            res.json(trades);
          }
        });
      } else {
        pendingFiles--;
        if (pendingFiles === 0) {
          res.json(trades);
        }
      }
    });
  });
});

// ----------------------------------------
// New Endpoint: Edit Closed Trade
// ----------------------------------------
app.post('/edit-closed-trade', (req, res) => {
  const updatedTrade = req.body;
  // Validate required fields
  if (
    !updatedTrade.ticker ||
    !updatedTrade.entry ||
    !updatedTrade.size ||
    !updatedTrade.opened_date ||
    !updatedTrade.exit ||
    !updatedTrade.closed_date ||
    !updatedTrade.filename
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Ensure ticker is uppercase and ends with USD
  let ticker = updatedTrade.ticker.toUpperCase();
  if (!ticker.endsWith("USD")) {
    ticker += "USD";
  }
  updatedTrade.ticker = ticker;
  
  // Rebuild the file content for a closed trade
  const content =
    `Ticker: ${updatedTrade.ticker}\n` +
    `Entry Price: ${updatedTrade.entry}\n` +
    `Position Size: ${updatedTrade.size}\n` +
    `Opened Date: ${updatedTrade.opened_date}\n` +
    `Exit Price: ${updatedTrade.exit}\n` +
    `Closed Date: ${updatedTrade.closed_date}\n`;
    
  const filepath = path.join(closedTradesFolder, updatedTrade.filename);
  fs.writeFile(filepath, content, 'utf8', err => {
    if (err) {
      console.error("Error editing closed trade file:", err);
      return res.status(500).json({ error: 'Failed to edit closed trade file' });
    }
    return res.json({ message: 'Closed trade updated', filename: updatedTrade.filename });
  });
});

// ----------------------------------------
// New Endpoint: Delete Closed Trade
// ----------------------------------------
app.post('/delete-closed-trade', (req, res) => {
  const data = req.body;
  if (!data.filename) {
    return res.status(400).json({ error: 'Missing filename' });
  }
  const filepath = path.join(closedTradesFolder, data.filename);
  fs.unlink(filepath, (err) => {
    if (err) {
      console.error("Error deleting closed trade file:", err);
      return res.status(500).json({ error: 'Failed to delete closed trade file' });
    }
    return res.json({ message: 'Closed trade deleted successfully' });
  });
});


// ----------------------------------------
// New Endpoint: Edit Trade
// ----------------------------------------
app.post('/edit-trade', (req, res) => {
  const updatedTrade = req.body;
  // Check that all required fields are present
  if (!updatedTrade.ticker || !updatedTrade.entry || !updatedTrade.tp || !updatedTrade.sl || !updatedTrade.size || !updatedTrade.filename) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Ensure ticker is uppercase and ends with USD
  let ticker = updatedTrade.ticker.toUpperCase();
  if (!ticker.endsWith("USD")) {
    ticker += "USD";
  }
  updatedTrade.ticker = ticker;
  
  // Option: You might want to preserve the current price, but here we set it to the entry price.
  updatedTrade.current = updatedTrade.entry;
  
  const content =
    `Ticker: ${updatedTrade.ticker}\n` +
    `Entry Price: ${updatedTrade.entry}\n` +
    `Take Profit: ${updatedTrade.tp}\n` +
    `Stop Loss: ${updatedTrade.sl}\n` +
    `Position Size: ${updatedTrade.size}\n` +
    `Current Price: ${updatedTrade.current}\n`;
    
  const filepath = path.join(openTradesFolder, updatedTrade.filename);
  fs.writeFile(filepath, content, 'utf8', err => {
    if (err) {
      console.error("Error editing trade file:", err);
      return res.status(500).json({ error: 'Failed to edit trade file' });
    }
    return res.json({ message: 'Trade updated', filename: updatedTrade.filename });
  });
});

// ----------------------------------------
// New Endpoint: Close Trade
// ----------------------------------------
app.post('/close-trade', (req, res) => {
  const closeData = req.body;
  if (!closeData.exit || !closeData.filename) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Read the open trade file to get its current content.
  const openFilePath = path.join(openTradesFolder, closeData.filename);
  fs.readFile(openFilePath, 'utf8', (readErr, data) => {
    if (readErr) {
      console.error("Error reading trade file for closing:", readErr);
      return res.status(500).json({ error: 'Failed to read trade file' });
    }
    
    // Extract open date from filename.
    const filenameParts = closeData.filename.split('_');
    let openDateFormatted = "N/A";
    if (filenameParts.length >= 2) {
      // Remove extension from second part and extract first 8 characters.
      let dateTimePart = filenameParts[1].replace('.txt', '');
      const openDateRaw = dateTimePart.substring(0, 8); // e.g., "20250305"
      const openYear = openDateRaw.substring(0, 4);
      const openMonth = openDateRaw.substring(4, 6);
      const openDay = openDateRaw.substring(6, 8);
      // Format as MM/DD/YY
      openDateFormatted = `${openMonth}/${openDay}/${openYear.substring(2)}`;
    }
    
    // Append the open date, exit price, and closed date to the content.
	const closedDate = new Date().toLocaleDateString('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: '2-digit'
});
    const closedContent = data +
      `Opened Date: ${openDateFormatted}\n` +
      `Exit Price: ${closeData.exit}\n` +
      `Closed Date: ${closedDate}\n`;
    
    // Create a new filename for the closed trade.
    // For example, use the original filename's prefix and append "_closed"
    const closedFilename = filenameParts[0] + '_' + filenameParts[1] + '_closed.txt';
    const closedFilePath = path.join(closedTradesFolder, closedFilename);
    
    // Write the closed trade file.
    fs.writeFile(closedFilePath, closedContent, 'utf8', (writeErr) => {
      if (writeErr) {
        console.error("Error writing closed trade file:", writeErr);
        return res.status(500).json({ error: 'Failed to write closed trade file' });
      }
      // Delete the open trade file.
      fs.unlink(openFilePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting open trade file:", unlinkErr);
          return res.status(500).json({ error: 'Failed to delete open trade file' });
        }
        return res.json({ message: 'Trade closed successfully', closedFilename });
      });
    });
  });
});

// New endpoint to serve starting balance
app.get('/starting-balance', (req, res) => {
  const balanceFilePath = path.join(__dirname, 'balance', 'starting.txt');
  fs.readFile(balanceFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading starting balance:', err);
      return res.status(500).json({ error: 'Failed to read starting balance' });
    }
    return res.json({ balance: data.trim() });
  });
});


// ----------------------------------------
// Helper Functions
// ----------------------------------------

// Helper function to parse an open trade file's content into a trade object
function parseTradeFile(data) {
  let lines = data.split('\n');
  let trade = {};
  lines.forEach(line => {
    if (line.includes(':')) {
      let [key, value] = line.split(':');
      key = key.trim();
      value = value.trim();
      if (key === "Ticker") {
        trade.ticker = value;
      } else if (key === "Entry Price") {
        trade.entry = parseFloat(value);
      } else if (key === "Take Profit") {
        trade.tp = parseFloat(value);
      } else if (key === "Stop Loss") {
        trade.sl = parseFloat(value);
      } else if (key === "Position Size") {
        trade.size = parseFloat(value);
      } else if (key === "Current Price") {
        trade.current = parseFloat(value);
      }
    }
  });
  return trade;
}

// Helper function to parse a closed trade file's content into a trade object
function parseClosedTradeFile(data) {
  let lines = data.split('\n');
  let trade = {};
  lines.forEach(line => {
    if (line.includes(':')) {
      let [key, value] = line.split(':');
      key = key.trim();
      value = value.trim();
      if (key === "Ticker") {
        trade.ticker = value;
      } else if (key === "Opened Date") {
        trade.opened_date = value;
      } else if (key === "Closed Date") {
        trade.closed_date = value;
      } else if (key === "Entry Price") {
        trade.entry = parseFloat(value);
      } else if (key === "Position Size") {
        trade.size = parseFloat(value);
      } else if (key === "Exit Price") {
        trade.exit = parseFloat(value);
      }
    }
  });
  return trade;
}

// ----------------------------------------
// Endpoints complete - Serve static files
// ----------------------------------------
app.use(express.static('public'));

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});