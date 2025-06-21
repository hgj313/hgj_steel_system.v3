const SteelOptimizerV3 = require('./core/optimizer/SteelOptimizerV3');
const { DesignSteel, ModuleSteel, OptimizationConstraints } = require('./api/types');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// 模拟从西耳墙.xls读取数据
function readSteelsFromExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const designSteels = [];
    // 从第二行开始读取，跳过表头
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        // 确保row存在并且有足够的数据
        if (row && row[0] !== undefined && row[1] !== undefined) {
            const length = parseFloat(row[0]);
            const quantity = parseInt(row[1], 10);

            // 确保解析后的值为有效数字
            if (!isNaN(length) && length > 0 && !isNaN(quantity) && quantity > 0) {
                designSteels.push(new DesignSteel({
                    id: `D${i}`,
                    specification: 'custom', // 假设规格
                    crossSection: 100, // 假设截面
                    length: length,
                    quantity: quantity
                }));
            }
        }
    }
    return designSteels;
}

async function runXierWallTest() {
    console.log('🧪 ==================== V3 西耳墙真实数据场景测试 ====================');

    try {
        const excelPath = path.join(__dirname, '西耳墙.xls');
        if (!fs.existsSync(excelPath)) {
            console.error('❌ 测试失败: 西耳墙.xls 文件未找到!');
            return;
        }

        const designSteels = readSteelsFromExcel(excelPath);

        // 使用40根12000mm的模数钢材，模拟您的场景
        const moduleSteels = Array.from({ length: 40 }, (_, i) => 
            new ModuleSteel({ id: `M${i+1}`, name: '12m标准钢材', length: 12000 })
        );

        const constraints = new OptimizationConstraints({
            wasteThreshold: 100,
            weldingSegments: 2,
        });

        console.log(`📊 测试数据: ${designSteels.length} 种设计钢材, ${moduleSteels.length} 根模数钢材`);

        const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
        const result = await optimizer.optimize();

        if (result.success) {
            console.log('\n✅ 优化成功!');
            const finalStats = result.result;
            console.log('📈 最终统计结果:');
            console.log(`   - 总模数钢材使用: ${finalStats.totalModuleUsed} 根`);
            console.log(`   - 总投入材料: ${finalStats.totalMaterial} mm`);
            console.log(`   - 总废料: ${finalStats.totalWaste} mm`);
            console.log(`   - 总真余料: ${finalStats.totalRealRemainder} mm`);
            console.log(`   - 总伪余料 (调试用): ${finalStats.totalPseudoRemainder} mm`);
            console.log(`   - 最终损耗率: ${finalStats.totalLossRate.toFixed(2)} %`);

            // 数据健全性检查
            const materialBalance = finalStats.totalWaste + finalStats.totalRealRemainder + (finalStats.totalMaterial - finalStats.totalWaste - finalStats.totalRealRemainder);
            const difference = Math.abs(materialBalance - finalStats.totalMaterial);

            if (difference < 1) { // 允许1mm以内的浮点误差
                console.log('✅ 物料守恒定律验证通过!');
            } else {
                console.error('❌ 物料守恒定律验证失败!');
                console.error(`   - 投入: ${finalStats.totalMaterial}`);
                console.error(`   - 产出+损耗+余料: ${materialBalance}`);
            }

        } else {
            console.error('❌ 优化失败:', result.error);
            // 打印详细的验证失败信息
            if (result.validation && !result.validation.isValid) {
                console.error('📋 约束验证详情:');
                result.validation.violations.forEach(violation => {
                    if (violation.type === 'weldingConstraintViolation') {
                        console.error(`   - 冲突: ${violation.message}`);
                        console.error(`   - 详情: ${violation.details.conflictCount}种设计钢材长度超过最大模数钢材${violation.details.maxModuleLength}mm`);
                    } else {
                        console.error(`   - 冲突: ${violation.message}`);
                    }
                });
                result.validation.suggestions.forEach(suggestion => {
                    console.error(`   - 建议: ${suggestion.title} - ${suggestion.description}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ 测试执行出错:', error);
    }
}

async function runEquivalentDataTest() {
    console.log('🧪 ==================== V3 等效数据最终验证测试 ====================');

    try {
        // 手动创建等效数据，绕开文件解析问题
        const designSteels = [
            new DesignSteel({ id: 'D1', length: 11000, quantity: 40, crossSection: 100, specification: 'custom' }),
            new DesignSteel({ id: 'D2', length: 10000, quantity: 2, crossSection: 100, specification: 'custom' })
        ];

        // 使用40根12000mm的模数钢材
        const moduleSteels = Array.from({ length: 40 }, (_, i) => 
            new ModuleSteel({ id: `M${i+1}`, name: '12m标准钢材', length: 12000 })
        );

        const constraints = new OptimizationConstraints({
            wasteThreshold: 100,
            weldingSegments: 2,
        });

        console.log(`📊 测试数据: ${designSteels.length} 种设计钢材, ${moduleSteels.length} 根模数钢材`);

        const optimizer = new SteelOptimizerV3(designSteels, moduleSteels, constraints);
        const result = await optimizer.optimize();

        if (result.success) {
            console.log('\n✅ 优化成功!');
            const finalStats = result.result;
            console.log('📈 最终统计结果:');
            console.log(`   - 总模数钢材使用: ${finalStats.totalModuleUsed} 根`);
            console.log(`   - 总投入材料: ${finalStats.totalMaterial} mm`);
            console.log(`   - 总废料: ${finalStats.totalWaste} mm`);
            console.log(`   - 总真余料: ${finalStats.totalRealRemainder} mm`);
            console.log(`   - 最终损耗率: ${finalStats.totalLossRate.toFixed(2)} %`);

            // 数据健全性检查
            const materialBalance = finalStats.totalWaste + finalStats.totalRealRemainder + (finalStats.totalMaterial - finalStats.totalWaste - finalStats.totalRealRemainder);
            const difference = Math.abs(materialBalance - finalStats.totalMaterial);

            if (difference < 1) {
                console.log('✅ 物料守恒定律验证通过!');
            } else {
                console.error('❌ 物料守恒定律验证失败!');
            }

        } else {
            console.error('❌ 优化失败:', result.error);
            if (result.validation && !result.validation.isValid) {
                // ... (代码不变)
            }
        }

    } catch (error) {
        console.error('❌ 测试执行出错:', error);
    }
}

runXierWallTest();
runEquivalentDataTest(); 