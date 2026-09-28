const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: import.meta.env.VITE_CURRENCY || 'USD', maximumFractionDigits: 2,
})
export const money = (value: number) => formatter.format(value)
