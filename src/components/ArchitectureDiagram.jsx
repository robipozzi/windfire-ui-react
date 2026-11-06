function ArchitectureDiagram() {
  const boxW = 180;
  const boxH = 70;
  const rx = 8;

  const clientBox = {
    fill: '#1a1a2e',
    stroke: '#61dafb',
    strokeWidth: 2,
  };

  const serverBox = {
    fill: '#1a2e1a',
    stroke: '#90ee90',
    strokeWidth: 2,
  };

  const titleText = {
    fontFamily: 'monospace',
    fontSize: 13,
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  };

  const subtitleText = {
    fontFamily: 'monospace',
    fontSize: 11,
    fill: '#aaaaaa',
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  };

  const arrowLabelText = {
    fontFamily: 'monospace',
    fontSize: 11,
    fill: '#cccccc',
    textAnchor: 'middle',
  };

  // Box center coordinates
  const reactCx = 140;
  const reactCy = 80;
  const iosCx = 440;
  const iosCy = 80;
  const keycloakCx = 290;
  const keycloakCy = 265;

  // Arrow: react box bottom-center -> keycloak box top (offset left)
  const ar = {
    x1: reactCx,
    y1: reactCy + boxH / 2,
    x2: keycloakCx - 45,
    y2: keycloakCy - boxH / 2,
  };

  // Arrow: ios box bottom-center -> keycloak box top (offset right)
  const ai = {
    x1: iosCx,
    y1: iosCy + boxH / 2,
    x2: keycloakCx + 45,
    y2: keycloakCy - boxH / 2,
  };

  return (
    <svg
      width="600"
      height="360"
      viewBox="0 0 600 360"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#0d0d1a', borderRadius: 12 }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#61dafb" />
        </marker>
      </defs>

      {/* Arrow: windfire-ui-react -> Keycloak */}
      <line
        x1={ar.x1} y1={ar.y1}
        x2={ar.x2} y2={ar.y2}
        stroke="#61dafb"
        strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
      />
      <text
        x={(ar.x1 + ar.x2) / 2 - 28}
        y={(ar.y1 + ar.y2) / 2}
        style={arrowLabelText}
      >
        OIDC / OAuth2
      </text>

      {/* Arrow: windfire-ui-ios -> Keycloak */}
      <line
        x1={ai.x1} y1={ai.y1}
        x2={ai.x2} y2={ai.y2}
        stroke="#61dafb"
        strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
      />
      <text
        x={(ai.x1 + ai.x2) / 2 + 28}
        y={(ai.y1 + ai.y2) / 2}
        style={arrowLabelText}
      >
        OIDC / OAuth2
      </text>

      {/* Box: windfire-ui-react */}
      <rect
        x={reactCx - boxW / 2} y={reactCy - boxH / 2}
        width={boxW} height={boxH} rx={rx} ry={rx}
        {...clientBox}
      />
      <text x={reactCx} y={reactCy - 12} style={{ ...titleText, fill: '#61dafb' }}>
        windfire-ui-react
      </text>
      <text x={reactCx} y={reactCy + 12} style={subtitleText}>
        Browser UI
      </text>

      {/* Box: windfire-ui-ios */}
      <rect
        x={iosCx - boxW / 2} y={iosCy - boxH / 2}
        width={boxW} height={boxH} rx={rx} ry={rx}
        {...clientBox}
      />
      <text x={iosCx} y={iosCy - 12} style={{ ...titleText, fill: '#61dafb' }}>
        windfire-ui-ios
      </text>
      <text x={iosCx} y={iosCy + 12} style={subtitleText}>
        Native iPhone UI
      </text>

      {/* Box: Keycloak */}
      <rect
        x={keycloakCx - boxW / 2} y={keycloakCy - boxH / 2}
        width={boxW} height={boxH} rx={rx} ry={rx}
        {...serverBox}
      />
      <text x={keycloakCx} y={keycloakCy - 12} style={{ ...titleText, fill: '#90ee90' }}>
        Keycloak
      </text>
      <text x={keycloakCx} y={keycloakCy + 12} style={subtitleText}>
        Authentication Server
      </text>
    </svg>
  );
}

export default ArchitectureDiagram;
