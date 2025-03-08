// Global array to hold closed trades and pagination settings
let closedTrades = [];
let currentPage = 0;
const pageSize = 15;

// Function to load closed trades from the server endpoint
async function loadClosedTrades() {
  try {
    const response = await fetch('/closed-trades');
    closedTrades = await response.json();
    renderClosedTrades();
    renderPagination();
    updateClosedSummary(); // Update summary after loading data
  } catch (error) {
    console.error("Error loading closed trades:", error);
  }
}

// Function to render the current page of closed trades in the table
function renderClosedTrades() {
  const tbody = document.querySelector("#closedTradeTable tbody");
  tbody.innerHTML = ""; // Clear existing rows
  let start = currentPage * pageSize;
  let end = start + pageSize;
  let pageTrades = closedTrades.slice(start, end);

  pageTrades.forEach((trade, idx) => {
    // Calculate profit = (exit - entry) * size
    let profit = (trade.exit - trade.entry) * trade.size;
    // Calculate duration (in days) using opened and closed dates (assumes format MM/DD/YY)
    let duration = "N/A";
    if (trade.opened_date && trade.closed_date) {
      let [openMonth, openDay, openYear] = trade.opened_date.split('/');
      let [closeMonth, closeDay, closeYear] = trade.closed_date.split('/');
      let openDate = new Date(`20${openYear}`, openMonth - 1, openDay);
      let closeDate = new Date(`20${closeYear}`, closeMonth - 1, closeDay);
      let diffTime = Math.abs(closeDate - openDate);
      duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + "d";
    }
    // Calculate fees (fee rate = 0.004)
    let fee = trade.exit * trade.size * 0.004;
    // Net profit for this trade
    let netProfit = profit - fee;

    let row = document.createElement("tr");
    // Save the overall index (across all closedTrades) for later reference
    row.dataset.index = start + idx;
    row.innerHTML = `
      <td>${trade.ticker.replace("USD", "")}</td>
      <td>${trade.opened_date}</td>
      <td>${trade.closed_date}</td>
      <td>${formatNumber(trade.entry)}</td>
      <td>${formatNumber(trade.size)}</td>
      <td>${formatNumber(trade.exit)}</td>
      <td>$${formatNumber(netProfit)}</td>
      <td>${duration}</td>
      <td>$${formatNumber(fee)}</td>
    `;
    tbody.appendChild(row);
  });
}

// Function to render pagination controls
function renderPagination() {
  const paginationDiv = document.getElementById("closedPagination");
  paginationDiv.innerHTML = "";
  let totalPages = Math.ceil(closedTrades.length / pageSize);
  for (let i = 0; i < totalPages; i++) {
    let btn = document.createElement("button");
    btn.textContent = i + 1;
    btn.style.marginRight = "5px";
    if (i === currentPage) {
      btn.style.fontWeight = "bold";
    }
    btn.addEventListener("click", () => {
      currentPage = i;
      renderClosedTrades();
      renderPagination();
    });
    paginationDiv.appendChild(btn);
  }
}

// Function to update the summary information based on closed trade data
function updateClosedSummary() {
  let totalNetProfit = 0;
  let totalFees = 0;
  let totalDuration = 0;
  let winCount = 0;
  let lossCount = 0;
  let largestProfit = -Infinity;
  let largestLoss = Infinity;
  let tradeCount = closedTrades.length;

  closedTrades.forEach(trade => {
    let profit = (trade.exit - trade.entry) * trade.size;
    let fee = trade.exit * trade.size * 0.004;
    let netProfit = profit - fee;
    totalNetProfit += netProfit;
    totalFees += fee;
    
    if (trade.opened_date && trade.closed_date) {
      let [openMonth, openDay, openYear] = trade.opened_date.split('/');
      let [closeMonth, closeDay, closeYear] = trade.closed_date.split('/');
      let openDate = new Date(`20${openYear}`, openMonth - 1, openDay);
      let closeDate = new Date(`20${closeYear}`, closeMonth - 1, closeDay);
      let duration = (closeDate - openDate) / (1000 * 60 * 60 * 24);
      totalDuration += duration;
    }
    
    if (netProfit > 0) {
      winCount++;
    } else if (netProfit < 0) {
      lossCount++;
    }
    
    if (netProfit > largestProfit) {
      largestProfit = netProfit;
    }
    if (netProfit < largestLoss) {
      largestLoss = netProfit;
    }
  });
  
  let avgProfitPerTrade = tradeCount > 0 ? totalNetProfit / tradeCount : 0;
  let avgDuration = tradeCount > 0 ? totalDuration / tradeCount : 0;
  let winPercent = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;
  let lossPercent = tradeCount > 0 ? (lossCount / tradeCount) * 100 : 0;

  let summaryHTML = `
    Profit: $${totalNetProfit.toFixed(2)} |
    Profit/Trade: $${avgProfitPerTrade.toFixed(2)} |
    Duration: ${avgDuration.toFixed(1)} days |
    Wins: ${winPercent.toFixed(2)}% |
    Losses: ${lossPercent.toFixed(2)}% |
    Largest (+): $${largestProfit === -Infinity ? 0 : largestProfit.toFixed(2)} |
    Largest (-): $${largestLoss === Infinity ? 0 : largestLoss.toFixed(2)} |
    # of Trades: ${tradeCount} |
    Fees: $${totalFees.toFixed(2)}
  `;
  document.getElementById("closedSummary").innerHTML = summaryHTML;
}

// Utility function to format numbers (default 2 decimal places)
function formatNumber(value, precision = 9) {
  return parseFloat(value).toFixed(precision);
}

// =======================
// Context Menu Implementation for Closed Trades
// (Uses same colors and style as the Trade Tracker context menu)
// =======================
const closedContextMenu = document.getElementById("closedContextMenu");
let selectedClosedTradeIndex = null;

document.querySelector("#closedTradeTable").addEventListener("contextmenu", function(e) {
  e.preventDefault();
  let targetRow = e.target.closest("tr");
  if (targetRow) {
    selectedClosedTradeIndex = targetRow.dataset.index;
    closedContextMenu.style.top = `${e.pageY}px`;
    closedContextMenu.style.left = `${e.pageX}px`;
    closedContextMenu.style.display = "block";
  }
});

document.addEventListener("click", function(e) {
  if (!e.target.closest("#closedContextMenu")) {
    closedContextMenu.style.display = "none";
  }
});

// =======================
// Edit Closed Trade Modal Handling
// (Modal is hidden until the user selects "Edit Trade" from the context menu)
// =======================
const editClosedTradeModal = document.getElementById("editClosedTradeModal");
const editClosedTradeForm = document.getElementById("editClosedTradeForm");
const cancelClosedEditBtn = document.getElementById("cancelClosedEditBtn");

document.getElementById("closedCtxEdit").addEventListener("click", function() {
  closedContextMenu.style.display = "none";
  if (selectedClosedTradeIndex !== null) {
    let trade = closedTrades[selectedClosedTradeIndex];
    document.getElementById("editClosedTicker").value = trade.ticker.replace("USD", "");
    document.getElementById("editClosedEntry").value = trade.entry;
    document.getElementById("editClosedSize").value = trade.size;
    document.getElementById("editClosedOpenedDate").value = trade.opened_date;
    document.getElementById("editClosedExit").value = trade.exit;
    document.getElementById("editClosedClosedDate").value = trade.closed_date;
    editClosedTradeModal.style.display = "block";
  }
});

cancelClosedEditBtn.addEventListener("click", function() {
  editClosedTradeModal.style.display = "none";
});

editClosedTradeForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  let updatedClosedTrade = {
    ticker: document.getElementById("editClosedTicker").value,
    entry: parseFloat(document.getElementById("editClosedEntry").value),
    size: parseFloat(document.getElementById("editClosedSize").value),
    opened_date: document.getElementById("editClosedOpenedDate").value,
    exit: parseFloat(document.getElementById("editClosedExit").value),
    closed_date: document.getElementById("editClosedClosedDate").value,
    filename: closedTrades[selectedClosedTradeIndex].filename
  };

  try {
    const response = await fetch('/edit-closed-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedClosedTrade)
    });
    const result = await response.json();
    if (response.ok) {
      editClosedTradeModal.style.display = "none";
      loadClosedTrades();
    } else {
      alert("Error editing closed trade: " + result.error);
    }
  } catch (err) {
    console.error("Error editing closed trade:", err);
  }
});

// =======================
// Remove Closed Trade Handling
// =======================
document.getElementById("closedCtxDelete").addEventListener("click", async function() {
  closedContextMenu.style.display = "none";
  if (selectedClosedTradeIndex !== null) {
    if (confirm("Are you sure you want to delete this closed trade?")) {
      try {
        const response = await fetch('/delete-closed-trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: closedTrades[selectedClosedTradeIndex].filename })
        });
        const result = await response.json();
        if (response.ok) {
          loadClosedTrades();
        } else {
          alert("Error deleting closed trade: " + result.error);
        }
      } catch (err) {
        console.error("Error deleting closed trade:", err);
      }
    }
  }
});

// When the page content is loaded, load the closed trades
document.addEventListener("DOMContentLoaded", loadClosedTrades);
