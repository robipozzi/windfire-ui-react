import './App.css';
import ArchitectureDiagram from './components/ArchitectureDiagram';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>
          windfire-ui-react
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#aaaaaa', marginBottom: '2rem' }}>
          Windfire System Architecture
        </p>
        <ArchitectureDiagram />
      </header>
    </div>
  );
}

export default App;
