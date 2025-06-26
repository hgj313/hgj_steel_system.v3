import React, { Suspense, lazy } from 'react';
import { Card, Row, Col, Statistic, Alert, Typography, Skeleton } from 'antd';
import { TotalStats, ChartData } from '../../hooks/useOptimizationResults';
import { formatNumber } from '../../utils/steelUtils';

const { Text } = Typography;

// Lazy load the chart component
const LossRateChart = lazy(() => import('./LossRateChart'));

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

      {/* 规格化图表 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={24}>
          <Card title="各规格损耗率分析" size="small">
            <Suspense fallback={<Skeleton.Node active style={{ height: 300, width: '100%' }}><div/></Skeleton.Node>}>
              <LossRateChart data={chartData.lossRateData} />
            </Suspense>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default React.memo(ResultsOverview); 