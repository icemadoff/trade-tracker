// Global trades array will store the open trades loaded from your text files.
let trades = [];

// Global variable to track the current sort state
let currentSort = { column: null, order: 'asc' };

// Function to load open trades from the server endpoint (/open-trades)
async function loadOpenTrades() {
  try {
    const response = await fetch('/open-trades');
    trades = await response.json();
    updateTable(); // Populate the table initially
  } catch (error) {
    console.error("Error loading open trades:", error);
  }
}

// Utility function to format numbers (default 2 decimal places)
function formatNumber(value, precision = 2) {
  return parseFloat(value).toFixed(precision);
}

// Utility function to format numbers with 9 decimal places and trim trailing zeros
function formatNumber9(value) {
  let formatted = parseFloat(value).toFixed(9);
}

// Function to update the HTML table with trade data and calculated fields.
function updateTable() {
  const tbody = document.querySelector("#tradeTable tbody");
  tbody.innerHTML = ""; // Clear existing rows

  trades.forEach((trade, index) => {
    // Calculate metrics:
    const plPercent = ((trade.current - trade.entry) / trade.entry) * 100;
    const plDollar = (trade.current - trade.entry) * trade.size;
    const distTP = ((trade.tp - trade.current) / trade.current) * 100;
    const distSL = ((trade.current - trade.sl) / trade.current) * 100;
    const equity = trade.entry * trade.size;

    // Create a table row with the calculated data
    const row = document.createElement('tr');
    row.dataset.index = index;
    row.innerHTML = `
      <td>${trade.ticker.replace("USD", "")}</td>
      <td>${formatNumber9(trade.entry)}</td>
      <td>${formatNumber9(trade.current)}</td>
      <td style="color: ${plPercent >= 0 ? 'rgb(150,255,150)' : 'rgb(255,110,110)'}">${formatNumber(plPercent)}%</td>
      <td style="color: ${plDollar >= 0 ? 'rgb(150,255,150)' : 'rgb(255,110,110)'}">$${formatNumber(plDollar)}</td>
      <td>${formatNumber(distTP)}%</td>
      <td>${formatNumber(distSL)}%</td>
      <td>$${formatNumber(equity)}</td>
    `;

    // If a flash flag is set, add the corresponding CSS class
    if (trade.flash === "green") {
      row.classList.add("flash-green");
    } else if (trade.flash === "red") {
      row.classList.add("flash-red");
    }
    // Clear the flash flag so the flash only happens once.
    trade.flash = null;
    
    tbody.appendChild(row);
  });

  // After updating the table, update the summary below it.
  updateSummary();
}

// Function to update the summary information below the table.
function updateSummary() {
  let total_entry_value = 0;
  let total_current_value = 0;
  let total_equity = 0;

  trades.forEach(trade => {
    total_entry_value += trade.entry * trade.size;
    total_current_value += trade.current * trade.size;
    total_equity += trade.entry * trade.size;
  });

  // Calculate cumulative profit/loss
  let cum_pl_dollar = total_current_value - total_entry_value;
  let cum_pl_percent = total_entry_value ? (cum_pl_dollar / total_entry_value) * 100 : 0;
  // Assuming liquid value = total equity plus cumulative profit/loss
  let live_value = total_equity + cum_pl_dollar;
  let color_str = (cum_pl_dollar >= 0 ? 'rgb(150,255,150)' : 'rgb(255,110,110)');
  let sign = (cum_pl_dollar >= 0 ? '$' : '-$');

  // Create the summary HTML
  let summaryText = 
    `LIVE P/L: <span style="color:${color_str};">${sign}${Math.abs(cum_pl_dollar).toFixed(2)} | ${cum_pl_percent.toFixed(2)}%</span>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;` +
    `Equity in use: <span style="color:rgb(255,255,150);">$${total_equity.toFixed(2)}</span>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;` +
    `LIQUID VALUE: <span style="color:rgb(255,200,200);">$${live_value.toFixed(2)}</span>`;

  document.getElementById('summary').innerHTML = summaryText;
}

// Function to fetch the current price for a given trade using Kraken's API.
async function fetchCurrentPrice(trade) {
  const url = `https://api.kraken.com/0/public/Ticker?pair=${trade.ticker}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.error && data.error.length > 0) {
      console.error("API Error:", data.error);
      return null;
    }
    // Retrieve the first pair key from the result
    const pairKey = Object.keys(data.result)[0];
    const currentPrice = parseFloat(data.result[pairKey]["c"][0]);
    return currentPrice;
  } catch (err) {
    console.error("Error fetching price for", trade.ticker, err);
    return null;
  }
}

// Function to update the current prices for all trades and refresh the table.
async function updatePrices() {
  for (let trade of trades) {
    const newPrice = await fetchCurrentPrice(trade);
    if (newPrice && newPrice !== trade.current) {
      let prevPrice = trade.current;
      // Set flash flag: "green" for an increase, "red" for a decrease.
      trade.flash = newPrice > prevPrice ? "green" : "red";
      trade.current = newPrice;
    }
  }
  updateTable();
}

// Function to sort the trades array based on a given column index
function sortColumn(index) {
  if (currentSort.column === index) {
    currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = index;
    currentSort.order = 'asc';
  }
  
  trades.sort((a, b) => {
    let aValue, bValue;
    switch(index) {
      case 0:
        aValue = a.ticker.toUpperCase();
        bValue = b.ticker.toUpperCase();
        break;
      case 3:
        aValue = ((a.current - a.entry) / a.entry) * 100;
        bValue = ((b.current - b.entry) / b.entry) * 100;
        break;
      case 4:
        aValue = (a.current - a.entry) * a.size;
        bValue = (b.current - b.entry) * b.size;
        break;
      case 5:
        aValue = ((a.tp - a.current) / a.current) * 100;
        bValue = ((b.tp - b.current) / b.current) * 100;
        break;
      case 6:
        aValue = ((a.current - a.sl) / a.current) * 100;
        bValue = ((b.current - b.sl) / b.current) * 100;
        break;
      case 7:
        aValue = a.entry * a.size;
        bValue = b.entry * b.size;
        break;
      default:
        return 0;
    }
    if (aValue < bValue) return currentSort.order === 'asc' ? -1 : 1;
    if (aValue > bValue) return currentSort.order === 'asc' ? 1 : -1;
    return 0;
  });
  
  updateTable();
}

// Attach click events to sortable table headers
document.querySelectorAll("#tradeTable th").forEach((th, index) => {
  if ([0, 3, 4, 5, 6, 7].includes(index)) {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => sortColumn(index));
  }
});

// =======================
// Context Menu Implementation
// =======================
const contextMenu = document.getElementById("contextMenu");
let selectedTradeIndex = null;

document.querySelector("#tradeTable").addEventListener("contextmenu", function(e) {
  e.preventDefault();
  let targetRow = e.target.closest("tr");
  if (targetRow) {
    selectedTradeIndex = targetRow.dataset.index;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.display = "block";
  }
});

document.addEventListener("click", function(e) {
  if (!e.target.closest("#contextMenu")) {
    contextMenu.style.display = "none";
  }
});

// =======================
// Edit Trade Modal Handling
// =======================
const editTradeModal = document.getElementById("editTradeModal");
const editTradeForm = document.getElementById("editTradeForm");
const cancelEditBtn = document.getElementById("cancelEditBtn");

document.getElementById("ctxEdit").addEventListener("click", function() {
  contextMenu.style.display = "none";
  if (selectedTradeIndex !== null) {
    let trade = trades[selectedTradeIndex];
    document.getElementById("editTicker").value = trade.ticker.replace("USD", "");
    document.getElementById("editEntry").value = trade.entry;
    document.getElementById("editTP").value = trade.tp;
    document.getElementById("editSL").value = trade.sl;
    document.getElementById("editSize").value = trade.size;
    editTradeModal.style.display = "block";
  }
});

cancelEditBtn.addEventListener("click", function() {
  editTradeModal.style.display = "none";
});

editTradeForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  let updatedTrade = {
    ticker: document.getElementById("editTicker").value,
    entry: parseFloat(document.getElementById("editEntry").value),
    tp: parseFloat(document.getElementById("editTP").value),
    sl: parseFloat(document.getElementById("editSL").value),
    size: parseFloat(document.getElementById("editSize").value),
    filename: trades[selectedTradeIndex].filename
  };

  try {
    const response = await fetch('/edit-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTrade)
    });
    const result = await response.json();
    if (response.ok) {
      editTradeModal.style.display = "none";
      loadOpenTrades();
    } else {
      alert("Error editing trade: " + result.error);
    }
  } catch (err) {
    console.error("Error editing trade:", err);
  }
});

// =======================
// Close Trade Modal Handling
// =======================
const closeTradeModal = document.getElementById("closeTradeModal");
const closeTradeForm = document.getElementById("closeTradeForm");
const cancelCloseBtn = document.getElementById("cancelCloseBtn");

document.getElementById("ctxClose").addEventListener("click", function() {
  contextMenu.style.display = "none";
  if (selectedTradeIndex !== null) {
    let trade = trades[selectedTradeIndex];
    document.getElementById("closeTicker").value = trade.ticker.replace("USD", "");
    document.getElementById("closeEntry").value = trade.entry;
    document.getElementById("closeSize").value = trade.size;
    closeTradeModal.style.display = "block";
  }
});

cancelCloseBtn.addEventListener("click", function() {
  closeTradeModal.style.display = "none";
});

closeTradeForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  let closeData = {
    exit: parseFloat(document.getElementById("closeExit").value),
    filename: trades[selectedTradeIndex].filename
  };

  try {
    const response = await fetch('/close-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closeData)
    });
    const result = await response.json();
    if (response.ok) {
      closeTradeModal.style.display = "none";
      loadOpenTrades();
    } else {
      alert("Error closing trade: " + result.error);
    }
  } catch (err) {
    console.error("Error closing trade:", err);
  }
});

document.getElementById("addTradeBtn").addEventListener("click", function() {
  document.getElementById("addTradeModal").style.display = "block";
});

document.getElementById("cancelBtn").addEventListener("click", function() {
  document.getElementById("addTradeModal").style.display = "none";
});

// =======================
// Add Trade Form Submission Handling
// =======================
const addTradeForm = document.getElementById("addTradeForm");

addTradeForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  
  // Create new trade object from form values
  const newTrade = {
    ticker: document.getElementById("tickerInput").value,
    entry: parseFloat(document.getElementById("entryInput").value),
    tp: parseFloat(document.getElementById("tpInput").value),
    sl: parseFloat(document.getElementById("slInput").value),
    size: parseFloat(document.getElementById("sizeInput").value)
  };

  try {
    const response = await fetch('/add-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade)
    });
    const result = await response.json();
    if (response.ok) {
      // Close the modal and reload trades to include the new trade
      document.getElementById("addTradeModal").style.display = "none";
      loadOpenTrades();
    } else {
      alert("Error adding trade: " + result.error);
    }
  } catch (err) {
    console.error("Error adding trade:", err);
  }
});

// =======================
// End of Context Menu & Modal Handling
// =======================

// Load open trades when the app starts.
document.addEventListener("DOMContentLoaded", loadOpenTrades);
// Update current prices periodically.
setInterval(updatePrices, 2000);
