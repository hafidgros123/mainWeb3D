import './Hanger.css'

// A small picture that hangs from the top-left corner of the box it is placed in.
// The parent needs position: relative (Hanger.css already does that for the pages below).
// Resize all hangers with --hanger-size in Hanger.css.
function Hanger({ src, className = '' }) {
  return <img className={`hanger ${className}`.trim()} src={src} alt="" aria-hidden="true" draggable="false" />
}

export default Hanger
