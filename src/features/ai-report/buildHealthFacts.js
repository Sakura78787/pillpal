const positiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const trend = (items, field) => {
  const ordered = [...items].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  const values = ordered.map((item) => item[field]);
  return {
    count: values.length,
    earliest: values[0] ?? null,
    latest: values.at(-1) ?? null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    delta: values.length >= 2 ? values.at(-1) - values[0] : null,
    trendSufficient: values.length >= 2,
  };
};

const capRecent = (items) => [...items].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)).slice(0, 14);

export function buildHealthFacts(records = []) {
  const valid = { bloodPressure: [], bloodSugar: [], weight: [] };
  let invalidRecordCount = 0;

  for (const record of records.filter((item) => !item?.deleted_at)) {
    const values = record.values || {};
    if (record.record_type === 'blood_pressure') {
      const systolic = positiveNumber(values.systolic);
      const diastolic = positiveNumber(values.diastolic);
      if (!systolic || !diastolic) { invalidRecordCount += 1; continue; }
      const sample = { recordedAt: record.recorded_at, systolic, diastolic };
      const heartRate = positiveNumber(values.heart_rate);
      if (heartRate) sample.heartRate = heartRate;
      valid.bloodPressure.push(sample);
    } else if (record.record_type === 'blood_sugar') {
      const value = positiveNumber(values.value);
      if (!value) { invalidRecordCount += 1; continue; }
      const timing = ['fasting', 'post_meal', 'random'].includes(values.timing) ? values.timing : 'random';
      valid.bloodSugar.push({ recordedAt: record.recorded_at, value, timing });
    } else if (record.record_type === 'weight') {
      const value = positiveNumber(values.value);
      if (!value) { invalidRecordCount += 1; continue; }
      const sample = { recordedAt: record.recorded_at, value };
      const bmi = positiveNumber(values.bmi);
      if (bmi) sample.bmi = bmi;
      valid.weight.push(sample);
    }
  }

  const samples = {
    bloodPressure: capRecent(valid.bloodPressure),
    bloodSugar: capRecent(valid.bloodSugar),
    weight: capRecent(valid.weight),
  };
  const sugarByTiming = (timing) => samples.bloodSugar.filter((item) => item.timing === timing);
  return {
    totalCounts: {
      bloodPressure: valid.bloodPressure.length,
      bloodSugar: valid.bloodSugar.length,
      weight: valid.weight.length,
    },
    sentCounts: {
      bloodPressure: samples.bloodPressure.length,
      bloodSugar: samples.bloodSugar.length,
      weight: samples.weight.length,
    },
    invalidRecordCount,
    samples,
    trends: {
      bloodPressure: {
        systolic: trend(samples.bloodPressure, 'systolic'),
        diastolic: trend(samples.bloodPressure, 'diastolic'),
        heartRate: trend(samples.bloodPressure.filter((item) => item.heartRate), 'heartRate'),
      },
      bloodSugar: {
        fasting: trend(sugarByTiming('fasting'), 'value'),
        postMeal: trend(sugarByTiming('post_meal'), 'value'),
        random: trend(sugarByTiming('random'), 'value'),
      },
      weight: trend(samples.weight, 'value'),
    },
    dataGapCodes: invalidRecordCount ? ['invalid_health_values_excluded'] : [],
  };
}
