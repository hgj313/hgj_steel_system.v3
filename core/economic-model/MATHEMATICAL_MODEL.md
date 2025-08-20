# 线材加工收益成本模型数学原理

## 模型假设

1. 单周期生产模型（月/季度）
2. 能源消耗与产量呈线性关系
3. 设备折旧按固定周期计提
4. 人工成本按标准工时计算

## 核心公式

**净利润计算函数**：

```math
\text{NetProfit} = \underbrace{P_{\text{sale}} \cdot Q}_{\text{销售收入}} - \left( \underbrace{C_{\text{material}} \cdot Q}_{\text{材料成本}} + \underbrace{C_{\text{labor}} \cdot H}_{\text{人工成本}} + \underbrace{D_{\text{equipment}}}_{\text{设备折旧}} + \underbrace{C_{\text{energy}} \cdot E_{\text{base}}}_{\text{能源成本}} \right)
```

**参数说明**：

| 符号               | 含义                | 单位   | 代码对应字段              |
|--------------------|--------------------|--------|--------------------------|
| $P_{\text{sale}}$ | 销售单价            | 元/吨  | sellingPricePerTon       |
| $Q$                | 生产量              | 吨     | productionCapacity       |
| $C_{\text{material}}$ | 材料单位成本    | 元/吨  | materialCostPerTon       |
| $C_{\text{labor}}$   | 小时人工成本      | 元/小时| laborCostPerHour         |
| $H$                | 标准工时数          | 小时   | 固定值720（月基准）      |
| $D_{\text{equipment}}$ | 设备折旧额    | 元     | equipmentDepreciation    |
| $C_{\text{energy}}$  | 能源单价          | 元/kWh | energyCostPerKWH         |
| $E_{\text{base}}$    | 基准能耗量        | kWh    | 固定值3000（月基准）     |

## 计算示例

给定参数：
```
P_sale=6500, Q=100,
C_material=5000, H=720,
C_labor=50, D_equipment=12000,
C_energy=1.2, E_base=3000
```

分步计算：
```math
\begin{align*}
\text{销售收入} &= 6500 \times 100 = 650,000\\
\text{材料成本} &= 5000 \times 100 = 500,000\\
\text{人工成本} &= 50 \times 720 = 36,000\\
\text{能源成本} &= 1.2 \times 3000 = 3,600\\
\text{总成本} &= 500,000 + 36,000 + 12,000 + 3,600 = 551,600\\
\text{净利润} &= 650,000 - 551,600 = 98,400
\end{align*}
```

## 约束条件

```math
\begin{cases}
C_{\text{material}} > 0\\
C_{\text{labor}} > 0\\
D_{\text{equipment}} \geq 0\\
Q \geq 0
\end{cases}
```

## 敏感性分析

关键参数对净利润的影响系数：
```math
\beta_{P} = \frac{\partial \text{NetProfit}}{\partial P_{\text{sale}}} = Q
```
```math
\beta_{C_m} = \frac{\partial \text{NetProfit}}{\partial C_{\text{material}}} = -Q
```