import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartData } from '../../hooks/useOptimizationResults';

interface LossRateChartProps {
  data: ChartData['lossRateData'];
}

const LossRateChart: React.FC<LossRateChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="specification" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="lossRate"
          stroke="#8884d8"
          name="损耗率 (%)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LossRateChart; 