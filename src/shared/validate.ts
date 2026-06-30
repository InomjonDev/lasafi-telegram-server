const fieldLabels: Record<string, string> = {
  title: 'Nomi',
  price: 'Narxi',
  product_title: 'Mahsulot nomi',
  customer_name: 'Mijoz ismi',
  phone: 'Telefon',
  address: 'Manzil',
}

export function validate(fields: Record<string, unknown>, rules: Record<string, string>) {
  const errors: string[] = []
  for (const [key, type] of Object.entries(rules)) {
    const val = fields[key]
    const label = fieldLabels[key] || key
    if (type === 'required' && (val === undefined || val === null || val === '')) {
      errors.push(`${label} kiritilishi shart`)
    }
    if (type === 'number' && val !== undefined && val !== null && val !== '' && (typeof val !== 'number' || isNaN(val))) {
      errors.push(`${label} son bo'lishi kerak`)
    }
    if (type === 'positive' && typeof val === 'number' && val <= 0) {
      errors.push(`${label} musbat son bo'lishi kerak`)
    }
  }
  return errors
}
