import { validatePositiveNumber } from '../utils/ValidationUtils';

export interface CostParameters {
  materialCostPerTon: number;
  laborCostPerHour: number;
  equipmentDepreciation: number;
  energyCostPerKWH: number;
  productionCapacity: number;
}

export class SteelProcessingEconomicModel {
  static calculateNetProfit(params: CostParameters, sellingPricePerTon: number): number {
    const {
      materialCostPerTon,
      laborCostPerHour,
      equipmentDepreciation,
      energyCostPerKWH,
      productionCapacity
    } = this.validateParameters(params);

    // 基础成本计算
    const materialCost = materialCostPerTon * productionCapacity;
    const laborCost = laborCostPerHour * 720; // 按月计算
    const energyCost = energyCostPerKWH * 3000; // 典型月耗电量

    // 综合成本
    const totalCost = materialCost + laborCost + equipmentDepreciation + energyCost;
    
    // 收益计算
    const revenue = sellingPricePerTon * productionCapacity;
    
    return revenue - totalCost;
  }

  private static validateParameters(params: CostParameters) {
    return {
      materialCostPerTon: validatePositiveNumber(params.materialCostPerTon, '原材料成本'),
      laborCostPerHour: validatePositiveNumber(params.laborCostPerHour, '人工成本'),
      equipmentDepreciation: validatePositiveNumber(params.equipmentDepreciation, '设备折旧'),
      energyCostPerKWH: validatePositiveNumber(params.energyCostPerKWH, '能源成本'),
      productionCapacity: validatePositiveNumber(params.productionCapacity, '生产能力')
    };
  }
}