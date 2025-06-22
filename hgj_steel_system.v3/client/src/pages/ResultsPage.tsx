import React, { useState, useEffect, useRef } from 'react';
import { 
  Alert, 
  Tabs, 
  Typography, 
  Button,
  Space,
  message
} from 'antd';
import { 
  FileExcelOutlined, 
  FilePdfOutlined
} from '@ant-design/icons';
import { useOptimizationContext } from '../contexts/OptimizationContext';
import { useOptimizationResults } from '../hooks/useOptimizationResults';
import ResultsOverview from '../components/results/ResultsOverview';
import CuttingPlansTable from '../components/results/CuttingPlansTable';
import RequirementsValidation from '../components/results/RequirementsValidation';
import ProcurementList from '../components/results/ProcurementList';

const { Title } = Typography;
const { TabPane } = Tabs;

const ResultsPage: React.FC = () => {
  const { currentOptimization, designSteels, moduleSteels } = useOptimizationContext();
  const results = currentOptimization?.results;
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const hasWarnedRef = useRef(false);

  // 使用统一的数据处理Hook - 这是解决错误引用值问题的核心
  const processedResults = useOptimizationResults(results, designSteels, moduleSteels);

  // 自动化调试输出和错误检测
  useEffect(() => {
    console.log('【ResultsPage V3】自动排查开始');
    console.log('【数据源】results:', results);
    console.log('【数据源】designSteels:', designSteels);
    console.log('【数据源】moduleSteels:', moduleSteels);
    console.log('【处理结果】processedResults:', processedResults);
    
    // 数据一致性验证
    if (results?.solutions) {
      console.log('【一致性检查】后端统计 vs 前端处理:');
      console.log('- 后端totalModuleUsed:', results.totalModuleUsed);
      console.log('- 前端totalModuleCount:', processedResults.totalStats.totalModuleCount);
      console.log('- 后端totalMaterial:', results.totalMaterial);
      console.log('- 前端totalModuleLength:', processedResults.totalStats.totalModuleLength);
      console.log('- 后端totalWaste:', results.totalWaste);
      console.log('- 前端totalWaste:', processedResults.totalStats.totalWaste);
      
      // 检查数据一致性
      if (results.totalModuleUsed !== processedResults.totalStats.totalModuleCount) {
        console.warn('⚠️ 数据不一致：模数钢材用量');
      }
      if (results.totalMaterial !== processedResults.totalStats.totalModuleLength) {
        console.warn('⚠️ 数据不一致：模数钢材总长度');
      }
      if (results.totalWaste !== processedResults.totalStats.totalWaste) {
        console.warn('⚠️ 数据不一致：废料统计');
      }
    }

    // 错误提示
    if (processedResults.hasDataError) {
      message.error(`数据异常：${processedResults.errorMessage}`);
    } else if (!processedResults.isAllRequirementsSatisfied) {
      if (!hasWarnedRef.current) {
        message.warning('部分需求未满足，请检查优化配置');
        hasWarnedRef.current = true;
      }
    } else {
      hasWarnedRef.current = false;
      console.log('✅ 数据验证通过，所有需求已满足');
    }

    if (currentOptimization?.error) {
      message.error('后端错误：' + currentOptimization.error);
    }
    
    console.log('【ResultsPage V3】自动排查完成');
  }, [results, designSteels, moduleSteels, processedResults, currentOptimization]);

  // 错误状态处理
  if (processedResults.hasDataError) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message="数据异常"
          description={processedResults.errorMessage || '优化结果数据异常，请重新执行优化'}
          type="error"
          showIcon
          action={
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button size="small" onClick={() => window.location.reload()}>
                刷新页面
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // 空数据状态处理
  if (!results || !results.solutions) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message="暂无优化结果"
          description="请先执行钢材优化以查看结果。如果已执行优化但未显示结果，请检查优化配置。"
          type="warning"
          showIcon
          action={
            <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button size="small" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
            </div>
          }
        />
      </div>
    );
  }

  console.log('🔍 ResultsPage V3渲染信息:', {
    resultsKeys: Object.keys(results.solutions),
    designSteelsCount: designSteels?.length || 0,
    moduleSteelsCount: moduleSteels?.length || 0,
    processedStats: processedResults.totalStats,
    hasDataError: processedResults.hasDataError
  });

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>V3规格化优化结果分析</Title>

      {/* 顶部需求满足提示条已由父级统一显示，避免重复 */}
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="概览图表" key="overview">
          <ResultsOverview
            totalStats={processedResults.totalStats}
            chartData={processedResults.chartData}
            isAllRequirementsSatisfied={processedResults.isAllRequirementsSatisfied}
          />
        </TabPane>

        <TabPane tab="规格化切割方案" key="cutting">
          <CuttingPlansTable
            regroupedResults={processedResults.regroupedResults}
            designIdToDisplayIdMap={processedResults.designIdToDisplayIdMap}
          />
        </TabPane>

        <TabPane tab="需求验证" key="requirements">
          <RequirementsValidation
            requirementValidation={processedResults.requirementValidation}
            isAllRequirementsSatisfied={processedResults.isAllRequirementsSatisfied}
          />
        </TabPane>

        <TabPane tab="规格化采购清单" key="procurement">
          <ProcurementList
            moduleUsageStats={processedResults.moduleUsageStats}
          />
        </TabPane>
      </Tabs>

      {/* 导出功能 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Space>
          <Button 
            type="primary" 
            icon={<FileExcelOutlined />} 
            size="large"
            loading={exporting}
            onClick={() => {
              setExporting(true);
              // TODO: 实现导出功能
              setTimeout(() => {
                setExporting(false);
                message.success('导出功能开发中');
              }, 1000);
            }}
          >
            导出V3规格化报告
          </Button>
          <Button 
            icon={<FilePdfOutlined />} 
            size="large"
            onClick={() => {
              message.info('PDF导出功能开发中');
            }}
          >
            导出PDF报告
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default ResultsPage; 