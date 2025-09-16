// app/components/RealTimeChart.tsx

'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface MarketData {
  timestamp: string;
  security: string;
  last_price: number;
  prev_close: number;
  change_pct: number;
  bid: number | null;
  ask: number | null;
  volume: number | null;
}

interface ChartData {
  timestamp: Date;
  change_pct: number;
}

const RealTimeChart: React.FC = () => {
  const [securities, setSecurities] = useState<string[]>(['AAPL US Equity', 'MSFT US Equity', 'GOOGL US Equity']);
  const [chartData, setChartData] = useState<Map<string, ChartData[]>>(new Map());
  const [currentPrices, setCurrentPrices] = useState<Map<string, MarketData>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [newSecurity, setNewSecurity] = useState('');
  const ws = useRef<WebSocket | null>(null);
  const maxDataPoints = 100; // チャートに表示する最大データポイント数

  // カラーパレット
  const colors = [
    'rgb(255, 99, 132)',
    'rgb(54, 162, 235)',
    'rgb(255, 206, 86)',
    'rgb(75, 192, 192)',
    'rgb(153, 102, 255)',
    'rgb(255, 159, 64)',
  ];

  useEffect(() => {
    // WebSocket接続
    const connectWebSocket = () => {
      try {
        ws.current = new WebSocket('ws://localhost:8765');

        ws.current.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          
          // 証券をサブスクライブ
          if (securities.length > 0) {
            ws.current?.send(JSON.stringify({
              action: 'subscribe',
              securities: securities
            }));
          }
        };

        ws.current.onmessage = (event) => {
          const data: MarketData = JSON.parse(event.data);
          
          if (data.type === 'subscription_confirmed') {
            console.log('Subscription confirmed:', data);
            return;
          }

          // 現在価格を更新
          setCurrentPrices(prev => {
            const newPrices = new Map(prev);
            newPrices.set(data.security, data);
            return newPrices;
          });

          // チャートデータを更新
          setChartData(prev => {
            const newData = new Map(prev);
            const securityData = newData.get(data.security) || [];
            
            const newPoint: ChartData = {
              timestamp: new Date(data.timestamp),
              change_pct: data.change_pct
            };

            // データポイントを追加（最大数を超えたら古いものを削除）
            const updatedData = [...securityData, newPoint];
            if (updatedData.length > maxDataPoints) {
              updatedData.shift();
            }
            
            newData.set(data.security, updatedData);
            return newData;
          });
        };

        ws.current.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          
          // 3秒後に再接続を試みる
          setTimeout(connectWebSocket, 3000);
        };

        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      ws.current?.close();
    };
  }, []);

  // 証券リストが更新されたら再サブスクライブ
  useEffect(() => {
    if (isConnected && securities.length > 0) {
      ws.current?.send(JSON.stringify({
        action: 'subscribe',
        securities: securities
      }));
    }
  }, [securities, isConnected]);

  const addSecurity = () => {
    if (newSecurity && !securities.includes(newSecurity)) {
      setSecurities([...securities, newSecurity]);
      setNewSecurity('');
    }
  };

  const removeSecurity = (security: string) => {
    setSecurities(securities.filter(s => s !== security));
    setChartData(prev => {
      const newData = new Map(prev);
      newData.delete(security);
      return newData;
    });
    setCurrentPrices(prev => {
      const newPrices = new Map(prev);
      newPrices.delete(security);
      return newPrices;
    });
  };

  // チャートデータの準備
  const datasets = securities.map((security, index) => {
    const data = chartData.get(security) || [];
    return {
      label: security,
      data: data.map(d => ({
        x: d.timestamp,
        y: d.change_pct
      })),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '33',
      tension: 0.1,
      pointRadius: 0,
      borderWidth: 2,
    };
  });

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '前日比変化率 (%) - リアルタイム',
        font: {
          size: 16,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            second: 'HH:mm:ss',
            minute: 'HH:mm',
          },
        },
        title: {
          display: true,
          text: '時刻',
        },
      },
      y: {
        title: {
          display: true,
          text: '変化率 (%)',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Bloomberg リアルタイム変化率チャート</h1>
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● 接続中' : '● 未接続'}
        </div>
      </div>

      <div className="controls">
        <div className="add-security">
          <input
            type="text"
            placeholder="証券コード (例: AAPL US Equity)"
            value={newSecurity}
            onChange={(e) => setNewSecurity(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addSecurity()}
          />
          <button onClick={addSecurity}>追加</button>
        </div>
        
        <div className="securities-list">
          {securities.map(security => (
            <div key={security} className="security-tag">
              {security}
              <button onClick={() => removeSecurity(security)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-container">
        <Line data={{ datasets }} options={options} />
      </div>

      <div className="price-grid">
        {Array.from(currentPrices.entries()).map(([security, data]) => (
          <div key={security} className="price-card">
            <h3>{security}</h3>
            <div className="price-info">
              <div className="price-main">
                <span className="label">現在値:</span>
                <span className="value">${data.last_price?.toFixed(2)}</span>
              </div>
              <div className={`change ${data.change_pct >= 0 ? 'positive' : 'negative'}`}>
                <span className="label">前日比:</span>
                <span className="value">
                  {data.change_pct >= 0 ? '+' : ''}{data.change_pct?.toFixed(2)}%
                </span>
              </div>
              <div className="price-detail">
                <span className="label">前日終値:</span>
                <span className="value">${data.prev_close?.toFixed(2)}</span>
              </div>
              {data.volume && (
                <div className="price-detail">
                  <span className="label">出来高:</span>
                  <span className="value">{data.volume.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .container {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        h1 {
          font-size: 24px;
          margin: 0;
        }

        .status {
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: bold;
        }

        .status.connected {
          background: #e7f5e7;
          color: #27ae60;
        }

        .status.disconnected {
          background: #ffe5e5;
          color: #e74c3c;
        }

        .controls {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .add-security {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }

        .add-security input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .add-security button {
          padding: 8px 20px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .add-security button:hover {
          background: #0056b3;
        }

        .securities-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .security-tag {
          display: flex;
          align-items: center;
          padding: 5px 10px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 20px;
          gap: 8px;
        }

        .security-tag button {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 0;
          font-size: 18px;
          line-height: 1;
        }

        .chart-container {
          height: 400px;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }

        .price-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 15px;
        }

        .price-card {
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .price-card h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #333;
        }

        .price-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .price-main, .price-detail, .change {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .price-main {
          font-size: 18px;
          font-weight: bold;
        }

        .change.positive .value {
          color: #27ae60;
        }

        .change.negative .value {
          color: #e74c3c;
        }

        .label {
          color: #666;
          font-size: 14px;
        }

        .value {
          font-weight: 500;
        }

        .price-detail {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default RealTimeChart;