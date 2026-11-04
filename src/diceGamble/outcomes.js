export const OUTCOMES = [
  { min: 12, max: 15, videos: ['/gamble/12-15/kit.mp4'] },

  { min: 16, max: 21, images: ['/gamble/16-21/aykabron.webp'] },
  { min: 22, max: 24, images: ['/gamble/22-24/echidna.webp'] },

  { min: 27, max: 29, videos: ['/gamble/27-29/choose.mp4'] },
  { min: 30, max: 31, videos: ['/gamble/30-31/rat.mp4'] },
  { min: 32, max: 38, videos: ['/gamble/32-38/bob.mp4'] },
  { min: 46, max: 51, videos: ['/gamble/46-51/mage.mp4'] },
  { min: 52, max: 55, videos: ['/gamble/52-55/cheese.mp4'] },
  { min: 56, max: 59, videos: ['/gamble/56-59/dio.mp4'] },
  { min: 60, max: 66, videos: ['/gamble/60-66/electro.mp4'] },
  { min: 67, max: 67, videos: ['/gamble/67-67_hell/subaru.mp4'] },

  { min: 71, max: 73, videos: ['/gamble/71-73/no_money.mp4'] },
  { min: 74, max: 76, videos: ['/gamble/74-76/taco.mp4'] },

  { min: 84, max: 87, videos: ['/gamble/84-87/theymao.mp4'] },

  { min: 91, max: 95, videos: ['/gamble/91-95/hell_no.mp4'] },
]

export function findOutcome(total) {
  return OUTCOMES.find((row) => total >= row.min && total <= row.max) ?? null
}

// works for both video rows and image rows
export function pickVideo(row) {
  const list = row.videos ?? row.images ?? []
  const file = list[Math.floor(Math.random() * list.length)]
  return encodeURI(file)
}