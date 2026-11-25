import type { GlucoseRecord } from './types';

function atDayOffset(baseMidnightMs: number, dayOffset: number, hour: number, minute: number): number {
  return baseMidnightMs - dayOffset * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000 + minute * 60 * 1000;
}

export function generateSampleGlucoseRecords(nowMs: number = Date.now()): GlucoseRecord[] {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  const todayMidnight = d.getTime();

  const rawEntries: Array<Omit<GlucoseRecord, 'id' | 'uid' | 'measuredAtMs'> & { dayOffset: number; hour: number; minute: number }> = [
    { dayOffset: 0, hour: 7, minute: 15, valueMmol: 5.7, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '睡眠充足，晨起空腹' },
    { dayOffset: 0, hour: 9, minute: 40, valueMmol: 7.4, context: 'after_breakfast', mealLevel: 'light', exerciseLevel: 'light', medicationTaken: true, note: '全麦吐司+水煮蛋+豆浆，饭后散步20分钟' },

    { dayOffset: 1, hour: 7, minute: 10, valueMmol: 5.9, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 1, hour: 13, minute: 50, valueMmol: 8.6, context: 'after_lunch', mealLevel: 'heavy', exerciseLevel: 'none', medicationTaken: true, note: '外食面食偏多，午后未活动' },
    { dayOffset: 1, hour: 21, minute: 45, valueMmol: 6.8, context: 'bedtime', mealLevel: 'light', exerciseLevel: 'moderate', medicationTaken: true, note: '晚饭后慢跑30分钟' },

    { dayOffset: 2, hour: 7, minute: 20, valueMmol: 5.5, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 2, hour: 9, minute: 30, valueMmol: 7.1, context: 'after_breakfast', mealLevel: 'normal', exerciseLevel: 'none', medicationTaken: true, note: '燕麦牛奶配坚果' },
    { dayOffset: 2, hour: 19, minute: 55, valueMmol: 7.6, context: 'after_dinner', mealLevel: 'normal', exerciseLevel: 'light', medicationTaken: true, note: '清炒时蔬+糙米半碗' },

    { dayOffset: 3, hour: 7, minute: 5, valueMmol: 6.3, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '昨晚睡得稍晚' },
    { dayOffset: 3, hour: 14, minute: 10, valueMmol: 9.2, context: 'after_lunch', mealLevel: 'heavy', exerciseLevel: 'none', medicationTaken: false, note: '外出聚餐忘记带药' },
    { dayOffset: 3, hour: 22, minute: 10, valueMmol: 7.2, context: 'bedtime', mealLevel: 'light', exerciseLevel: 'light', medicationTaken: true, note: '' },

    { dayOffset: 4, hour: 7, minute: 25, valueMmol: 5.8, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 4, hour: 11, minute: 45, valueMmol: 5.2, context: 'before_lunch', mealLevel: 'none', exerciseLevel: 'moderate', medicationTaken: true, note: '上午快走40分钟' },
    { dayOffset: 4, hour: 20, minute: 15, valueMmol: 7.3, context: 'after_dinner', mealLevel: 'normal', exerciseLevel: 'light', medicationTaken: true, note: '' },

    { dayOffset: 5, hour: 7, minute: 30, valueMmol: 5.6, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 5, hour: 10, minute: 5, valueMmol: 7.7, context: 'after_breakfast', mealLevel: 'normal', exerciseLevel: 'none', medicationTaken: true, note: '豆沙包半个+鸡蛋' },
    { dayOffset: 5, hour: 17, minute: 40, valueMmol: 4.1, context: 'before_dinner', mealLevel: 'none', exerciseLevel: 'intense', medicationTaken: true, note: '羽毛球1小时后略感饥饿' },

    { dayOffset: 6, hour: 7, minute: 12, valueMmol: 5.4, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 6, hour: 14, minute: 0, valueMmol: 7.5, context: 'after_lunch', mealLevel: 'normal', exerciseLevel: 'light', medicationTaken: true, note: '杂粮饭+清蒸鱼' },

    { dayOffset: 8, hour: 7, minute: 20, valueMmol: 6.4, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 8, hour: 14, minute: 15, valueMmol: 10.4, context: 'after_lunch', mealLevel: 'heavy', exerciseLevel: 'none', medicationTaken: true, note: '精白米饭+红烧肉，餐后犯困' },
    { dayOffset: 9, hour: 7, minute: 18, valueMmol: 6.1, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 9, hour: 20, minute: 10, valueMmol: 8.1, context: 'after_dinner', mealLevel: 'normal', exerciseLevel: 'light', medicationTaken: true, note: '' },

    { dayOffset: 11, hour: 7, minute: 15, valueMmol: 6.0, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 11, hour: 9, minute: 50, valueMmol: 8.3, context: 'after_breakfast', mealLevel: 'normal', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 12, hour: 7, minute: 25, valueMmol: 5.9, context: 'fasting', mealLevel: 'none', exerciseLevel: 'none', medicationTaken: true, note: '' },
    { dayOffset: 13, hour: 20, minute: 5, valueMmol: 7.9, context: 'after_dinner', mealLevel: 'normal', exerciseLevel: 'moderate', medicationTaken: true, note: '饭后骑行25分钟' },
  ];

  return rawEntries
    .map((item, idx) => {
      const measuredAtMs = atDayOffset(todayMidnight, item.dayOffset, item.hour, item.minute);
      // Avoid generating future timestamps for today
      const safeMeasuredAtMs = measuredAtMs > nowMs ? nowMs - (idx + 1) * 35 * 60 * 1000 : measuredAtMs;
      return {
        id: `sample_rec_${String(idx + 1).padStart(2, '0')}`,
        uid: 'local_preview',
        valueMmol: item.valueMmol,
        context: item.context,
        measuredAtMs: safeMeasuredAtMs,
        note: item.note,
        mealLevel: item.mealLevel,
        exerciseLevel: item.exerciseLevel,
        medicationTaken: item.medicationTaken,
      };
    })
    .sort((a, b) => b.measuredAtMs - a.measuredAtMs);
}
