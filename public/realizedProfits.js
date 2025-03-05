// Fetch and display the starting balance
async function loadStartingBalance() {
  try {
    const response = await fetch('/starting-balance');
    const data = await response.json();
    document.getElementById('startingBalance').innerHTML = data.balance;
  } catch (error) {
    console.error('Error loading starting balance:', error);
    document.getElementById('startingBalance').innerHTML = 'Error loading balance';
  }
}

// New function to fetch the current price for a given trade using Kraken's API.
async function fetchCurrentPrice(trade) {
  const url = `https://api.kraken.com/0/public/Ticker?pair=${trade.ticker}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.error && data.error.length > 0) {
      console.error("API Error:", data.error);
      return trade.current; // Return the current price if there's an error.
    }
    const pairKey = Object.keys(data.result)[0];
    const currentPrice = parseFloat(data.result[pairKey]["c"][0]);
    return currentPrice;
  } catch (err) {
    console.error("Error fetching price for", trade.ticker, err);
    return trade.current; // Return the current price on error.
  }
}

// Calculate and display summary for open trades with live prices
async function loadOpenTradesSummary() {
  try {
    const response = await fetch('/open-trades');
    let trades = await response.json();
    
    // Update each trade's current price using the Kraken API.
    await Promise.all(trades.map(async (trade) => {
      const newPrice = await fetchCurrentPrice(trade);
      trade.current = newPrice;
    }));
    
    let totalEntryValue = 0;
    let totalCurrentValue = 0;
    let totalEquity = 0;
    
    trades.forEach(trade => {
      totalEntryValue += trade.entry * trade.size;
      totalCurrentValue += trade.current * trade.size;
      totalEquity += trade.entry * trade.size;
    });
    
    const cumPLDollar = totalCurrentValue - totalEntryValue;
    const cumPLPercent = totalEntryValue ? (cumPLDollar / totalEntryValue) * 100 : 0;
    const liveValue = totalEquity + cumPLDollar;
    const openTradesCount = trades.length;
    
    // Set color and sign based on performance
    const colorStr = (cumPLDollar >= 0 ? 'rgb(150,255,150)' : 'rgb(255,110,110)');
    const sign = (cumPLDollar >= 0 ? '$' : '-$');
    
    const summaryHTML = 
      `LIVE P/L: <span style="color:${colorStr};">${sign}${Math.abs(cumPLDollar).toFixed(2)} | ${cumPLPercent.toFixed(2)}%</span><br>` +
      `Equity in Use: <span style="color:rgb(255,255,150);">$${totalEquity.toFixed(2)}</span><br>` +
      `Liquid Value: <span style="color:rgb(255,200,200);">$${liveValue.toFixed(2)}</span><br>` +
      `Total Open Trades: ${openTradesCount}`;
    
    document.getElementById('openTradesSummary').innerHTML = summaryHTML;
  } catch (error) {
    console.error('Error loading open trades summary:', error);
    document.getElementById('openTradesSummary').innerHTML = 'Error loading data';
  }
}

// Calculate and display summary for closed trades
async function loadClosedTradesSummary() {
  try {
    const response = await fetch('/closed-trades');
    const trades = await response.json();
    
    let totalNetProfit = 0;
    let totalFees = 0;
    let totalDuration = 0;
    let winCount = 0;
    let lossCount = 0;
    let largestProfit = -Infinity;
    let largestLoss = Infinity;
    const tradeCount = trades.length;
    
    trades.forEach(trade => {
      let profit = (trade.exit - trade.entry) * trade.size;
      let fee = trade.exit * trade.size * 0.004;
      let netProfit = profit - fee;
      totalNetProfit += netProfit;
      totalFees += fee;
      
      // Calculate duration (assumes MM/DD/YY format)
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
    
    const avgProfitPerTrade = tradeCount > 0 ? totalNetProfit / tradeCount : 0;
    const avgDuration = tradeCount > 0 ? totalDuration / tradeCount : 0;
    const winPercent = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;
    const lossPercent = tradeCount > 0 ? (lossCount / tradeCount) * 100 : 0;
    
    const summaryHTML = 
      `Profit: $${totalNetProfit.toFixed(2)}<br>` +
      `Profit/Trade: $${avgProfitPerTrade.toFixed(2)}<br>` +
      `Duration: ${avgDuration.toFixed(1)} days<br>` +
      `Wins: ${winPercent.toFixed(2)}%<br>` +
      `Losses: ${lossPercent.toFixed(2)}%<br>` +
      `Largest (+$): $${largestProfit === -Infinity ? 0 : largestProfit.toFixed(2)}<br>` +
      `Largest (-$): $${largestLoss === Infinity ? 0 : largestLoss.toFixed(2)}<br>` +
      `# of Trades: ${tradeCount}<br>` +
      `Fees: $${totalFees.toFixed(2)}`;
    
    document.getElementById('closedTradesSummary').innerHTML = summaryHTML;
  } catch (error) {
    console.error('Error loading closed trades summary:', error);
    document.getElementById('closedTradesSummary').innerHTML = 'Error loading data';
  }
}

// Load all sections when the page content is loaded
document.addEventListener('DOMContentLoaded', () => {
  loadStartingBalance();
  loadOpenTradesSummary();
  loadClosedTradesSummary();
});

// Set an interval to update the open trades summary every 2 seconds.
setInterval(loadOpenTradesSummary, 2000);
