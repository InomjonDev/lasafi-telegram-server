export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  productTitle: string,
  price: number,
  customerName: string,
  phone: string,
  address: string,
  quantity?: number,
  productImage?: string,
  totalPrice?: number,
) {
  const qty = quantity ?? 1
  const total = totalPrice ?? price * qty
  const caption = [
    '🆕 NEW ORDER',
    '',
    `${productTitle}`,
    `${price} UZS × ${qty} = ${total} UZS`,
    '',
    `👤 ${customerName}`,
    `📞 ${phone}`,
    `📍 ${address}`,
    `🔢 ${qty} dona`,
  ].join('\n')

  const body: Record<string, string> = {
    chat_id: chatId,
  }

  if (productImage) {
    body.photo = productImage
    body.caption = caption
    await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } else {
    body.text = caption
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
}
