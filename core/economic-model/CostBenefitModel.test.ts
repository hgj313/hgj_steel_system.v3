import { CostParameters, SteelProcessingEconomicModel } from './CostBenefitModel';

describe('SteelProcessingEconomicModel', () => {
  const baseParams: CostParameters = {
    materialCostPerTon: 5000,
    laborCostPerHour: 50,
    equipmentDepreciation: 12000,
    energyCostPerKWH: 1.2,
    productionCapacity: 100
  };

  test('应正确计算净利润', () => {
    const sellingPrice = 6500;
    const profit = SteelProcessingEconomicModel.calculateNetProfit(baseParams, sellingPrice);
    
    // 验证计算逻辑
    const expectedProfit = (6500*100) - (5000*100 + 50*720 + 12000 + 1.2*3000);
    expect(profit).toBeCloseTo(expectedProfit);
  });

  test('应抛出负数参数异常', () => {
    const invalidParams = {...baseParams, materialCostPerTon: -100};
    expect(() => {
      SteelProcessingEconomicModel.calculateNetProfit(invalidParams, 6500)
    }).toThrow('原材料成本必须为正数');
  });

  test('应处理零生产能力', () => {
    const zeroProductionParams = {...baseParams, productionCapacity: 0};
    const profit = SteelProcessingEconomicModel.calculateNetProfit(zeroProductionParams, 6500);
    expect(profit).toBe(-(50*720 + 12000 + 1.2*3000));
  });
});