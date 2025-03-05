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

  pageTrades.forEach(trade => {
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
    // Calculate fees, e.g., fee = (exit * size) * feeRate (feeRate = 0.004)
    let fee = trade.exit * trade.size * 0.004;
    // Net profit for this trade
    let netProfit = profit - fee;

    let row = document.createElement("tr");
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
    
    // Calculate duration in days (assumes MM/DD/YY format)
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
    Wins: ${winPercent.toFixed(2)}% 
    Losses: ${lossPercent.toFixed(2)}% |
    Largest (+$): $${largestProfit === -Infinity ? 0 : largestProfit.toFixed(2)} |
    Largest (-$): $${largestLoss === Infinity ? 0 : largestLoss.toFixed(2)} |
    # of Trades: ${tradeCount} |
    Fees: $${totalFees.toFixed(2)}
  `;
  document.getElementById("closedSummary").innerHTML = summaryHTML;
}

// Utility function to format numbers (default 2 decimal places)
function formatNumber(value, precision = 2) {
  return parseFloat(value).toFixed(precision);
}

// When the page content is loaded, load the closed trades
document.addEventListener("DOMContentLoaded", loadClosedTrades);
