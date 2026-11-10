import { Component } from 'react';
export default class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main role="alert" style={{padding:32}}><h1>No se pudo abrir la página</h1><p>Comprueba tu conexión y vuelve a cargarla.</p><button type="button" onClick={()=>window.location.reload()}>Volver a cargar</button></main>;
    return this.props.children;
  }
}
