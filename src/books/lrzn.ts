/**
 * 《六壬指南注解》文档载荷 —— 仅供 docs.ts 动态导入（按书分包）。
 * 明末清初·陳公獻《大六壬指南》＋今·張洪注（2000，混排照录）；
 * 今注版权属注者，本库以 CC BY-NC 4.0 非商用汇编，如权利人异议即撤。
 */
import data from '../data/docs-lrzn.json';

export const payload = data as unknown as { docs: Record<string, string> };
