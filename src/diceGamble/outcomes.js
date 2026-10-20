export const OUTCOMES = [
  { min: 12, max: 15, videos: ['/12-15/kit.mp4'] },

  { min: 16, max: 21, images: ['/16-21/aykabron.jpg'] },
  { min: 22, max: 24, images: ['/22-24/echidna.gif'] },

  { min: 27, max: 29, videos: ['/27-29/choose.mp4'] },
  { min: 30, max: 31, videos: ['/30-31/rat.mp4'] },
  { min: 32, max: 38, videos: ['/32-38/bob.mp4'] },
  { min: 46, max: 51, videos: ['/46-51/mage.mp4'] },
  { min: 52, max: 55, videos: ['/52-55/cheese.mp4'] },
  { min: 56, max: 59, videos: ['/56-59/dio.mp4'] },

  // { min: 67, max: 67, videos: ['/hell(67_video)/your-video.mp4'] },

  { min: 71, max: 73, videos: ['/71-73/no_money.mp4'] },
  { min: 74, max: 76, videos: ['/74-76/taco.mp4'] },

  { min: 84, max: 87, videos: ['/84-87/theymao.mp4'] },

  { min: 91, max: 95, videos: ['/91-95/hell_no.mp4'] },
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