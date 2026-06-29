import 'dotenv/config'

export async function sendTelegramMessage(text: string): Promise<{ success: boolean; error?: string }> {
	const token = process.env.BOT_TOKEN
	const chatId = process.env.SELLER_CHAT_ID

	const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: chatId, text }),
	})

	const data = await res.json()

	if (!data.ok) {
		console.error('TELEGRAM ERROR:', data)
		return { success: false, error: data.description || 'Telegram xatosi' }
	}

	console.log('TELEGRAM SENT')
	return { success: true }
}
