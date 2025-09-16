// app/components/PriceCard.tsx

import React from 'react';
import { MarketData } from '../types/market';
import { formatNumber, formatPercent } from '../utils/formatters';

interface PriceCardProps {
  security: string;
  data: MarketData;
}

const PriceCard: React.FC<PriceCardProps> = ({ security, data }) => {
  const isPositive = data.change_pct >= 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">{security}</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">現在値:</span>
          <span className="text-lg font-bold text-gray-900">
            ${formatNumber(data.last_price)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">前日比:</span>
          <span className={`text-lg font-bold ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive && '+'}{formatPercent(data.change_pct)}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">前日終値:</span>
          <span className="text-md text-gray-700">
            ${formatNumber(data.prev_close)}
          </span>
        </div>

        {data.bid && data.ask && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Bid/Ask:</span>
              <span className="text-sm text-gray-700">
                ${formatNumber(data.bid)} / ${formatNumber(data.ask)}
              </span>
            </div>
          </div>
        )}

        {data.volume && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">出来高:</span>
            <span className="text-sm text-gray-700">
              {data.volume.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            更新: {new Date(data.timestamp).toLocaleTimeString('ja-JP')}
          </span>
          <div className={`w-2 h-2 rounded-full ${
            isPositive ? 'bg-green-500' : 'bg-red-500'
          } animate-pulse`}></div>
        </div>
      </div>
    </div>
  );
};

export default PriceCard;