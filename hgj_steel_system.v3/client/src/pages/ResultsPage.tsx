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

  // 导出Excel功能
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      
      const exportData = {
        optimizationResult: results,
        exportOptions: {
          format: 'excel',
          includeCharts: false,
          includeDetails: true,
          includeLossRateBreakdown: true,
          customTitle: `钢材优化报告_${new Date().toISOString().slice(0, 10)}`
        }
      };

      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Excel导出失败');
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = '钢材优化报告.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
        }
      }

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      message.success('Excel报告导出成功！');
    } catch (error) {
      console.error('Excel导出失败:', error);
      message.error(`Excel导出失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  // 导出PDF功能
  const handleExportPDF = async () => {
    try {
      setExporting(true);
      message.loading({ content: '正在生成报告...', key: 'export' });
      
      const exportData = {
        optimizationResult: results,
        exportOptions: {
          format: 'pdf', // 保留此参数以供后端识别
          includeDetails: true
        },
        designSteels: designSteels
      };

      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '报告生成请求失败');
      }

      const result = await response.json();
      
      if (result.success && result.htmlContent) {
        // [方案B]核心逻辑：在前端创建并下载文件
        const blob = new Blob([result.htmlContent], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = result.fileName || 'report.html';
        document.body.appendChild(a);
        a.click();
        
        // 清理
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        message.success({ content: '报告已成功下载！请在浏览器中打开并打印为PDF。', key: 'export', duration: 5 });
      } else {
        throw new Error(result.error || '后端返回的数据格式不正确');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('报告导出失败:', errorMessage);
      message.error({ content: `导出失败: ${errorMessage}`, key: 'export', duration: 3 });
    } finally {
      setExporting(false);
    }
  };

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
            onClick={handleExportExcel}
          >
            导出采购清单(Excel)
          </Button>
          <Button 
            icon={<FilePdfOutlined />} 
            size="large"
            loading={exporting}
            onClick={handleExportPDF}
          >
            导出完整报告(PDF)
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default ResultsPage; 