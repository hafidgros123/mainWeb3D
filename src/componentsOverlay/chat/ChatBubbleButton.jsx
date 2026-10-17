function ChatBubbleButton({ onOpen }) {
  return (
    <button className="chat-launcher" type="button" onClick={onOpen} aria-label="Open Ellen chat">
      <img src="/assets/character_transparent.webp" alt="Ellen" />
      <span>Chat with Smoll Ellen</span>
    </button>
  )
}

export default ChatBubbleButton
