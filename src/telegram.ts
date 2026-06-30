import 'dotenv/config'

const token = () => process.env.BOT_TOKEN
const chatId = () => process.env.SELLER_CHAT_ID

export async function sendTelegramMessage(text: string): Promise<{ success: boolean; error?: string }> {
	const res = await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: chatId(), text }),
	})

	const data = await res.json()

	if (!data.ok) {
		console.error('TELEGRAM ERROR:', data)
		return { success: false, error: data.description || 'Telegram xatosi' }
	}

	console.log('TELEGRAM SENT')
	return { success: true }
}

export async function sendTelegramPhoto(photo: string, caption: string): Promise<{ success: boolean; error?: string }> {
	const res = await fetch(`https://api.telegram.org/bot${token()}/sendPhoto`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId(),
			photo,
			caption,
		}),
	})

	const data = await res.json()

	if (!data.ok) {
		console.error('TELEGRAM PHOTO ERROR:', data)
		return { success: false, error: data.description || 'Telegram xatosi' }
	}

	console.log('TELEGRAM PHOTO SENT')
	return { success: true }
}
