import React from 'react';
import { Card, Row, Col, Statistic, Alert, Tag, Typography } from 'antd';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Tooltip
} from 'recharts';
import { TotalStats, ChartData } from '../../hooks/useOptimizationResults';
import { formatNumber } from '../../utils/steelUtils';

const { Text } = Typography;

interface ResultsOverviewProps {
  totalStats: TotalStats;
  chartData: ChartData;
  isAllRequirementsSatisfied: boolean;
}

const ResultsOverview: React.FC<ResultsOverviewProps> = ({
  totalStats,
  chartData,
  isAllRequirementsSatisfied
}) => {
  return (
    <>
      {/* 需求满足提示条 */}
      <Alert
        type={isAllRequirementsSatisfied ? 'success' : 'warning'}
        message={isAllRequirementsSatisfied ? '所有需求已满足' : '部分需求未满足'}
        showIcon
        style={{ marginBottom: 16, fontWeight: 500 }}
      />

      {/* V3规格化关键指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总模数钢材用量"
              value={totalStats.totalModuleCount}
              suffix="根"
              valueStyle={{ color: '#1890ff' }}
            />
            <Text type="secondary">
              {formatNumber(totalStats.totalModuleLength, 0)}mm
            </Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="平均损耗率"
              value={totalStats.overallLossRate}
              precision={2}
              suffix="%"
              valueStyle={{ color: totalStats.overallLossRate > 10 ? '#cf1322' : '#52c41a' }}
            />
            <Text type="secondary">
              损耗计算依据
            </Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总损耗"
              value={totalStats.totalRealRemainder + totalStats.totalWaste}
              suffix="mm"
              valueStyle={{ color: '#cf1322' }}
            />
            <div style={{ marginTop: 8, lineHeight: '1.5' }}>
              <Text type="secondary" style={{ display: 'block' }}>
                真余料: {formatNumber(totalStats.totalRealRemainder, 0)}mm
              </Text>
              <Text type="secondary" style={{ display: 'block' }}>
                废料: {formatNumber(totalStats.totalWaste, 0)}mm
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* V3规格化说明 */}
      <Alert
        type="success"
        message="V3规格化设计优势"
        description={
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color="green">直接按规格分类</Tag>
              <Text type="secondary">摆脱V2的截面面积映射妥协方案</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color="blue">规格化编号</Tag>
              <Text type="secondary">如HRB400-A1，更符合实际业务</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color="purple">真伪余料分离</Tag>
              <Text type="secondary">精确的余料状态管理</Text>
            </div>
          </div>
        }
        style={{ marginBottom: 16 }}
        showIcon
      />

      {/* 规格化图表 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="各规格损耗率分析" size="small">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.lossRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="specification" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="lossRate" stroke="#8884d8" name="损耗率 (%)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="各规格钢材使用分布" size="small">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default React.memo(ResultsOverview); 