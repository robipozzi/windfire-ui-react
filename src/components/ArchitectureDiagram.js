function ArchitectureDiagram() {
  const clientBoxStyle = {
    fill: '#1a1a2e',
    stroke: '#61dafb',
    strokeWidth: 2,
  };

  const keycloakBoxStyle = {
    fill: '#1a2e1a',
    stroke: '#90ee90',
    strokeWidth: 2,
  };

  const textStyle = {
    fill: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 13,
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  };

  const subtextStyle = {
    ...textStyle,
    fontSize: 11,
    fill: '#aaaaaa',
  };

  const labelStyle = {
    fill: '#cccccc',
    fontFamily: 'monospace',
    fontSize: 11,
    textAnchor: 'middle',
  };

  const boxW = 180;
  const boxH = 70;
  const rx = 8;

  // Box center coordinates
  const reactBox = { cx: 140, cy: 80 };
  const iosBox = { cx: 440, cy: 80 };
  const keycloakBox = { cx: 290, cy: 260 };

  // Arrow endpoints: from bottom-center of each client box to top-center of Keycloak box
  const arrowReact = {
    x1: reactBox.cx,
    y1: reactBox.cy + boxH / 2,
    x2: keycloakBox.cx - 40,
    y2: keycloakBox.cy - boxH / 2,
  };

  const arrowIos = {
    x1: iosBox.cx,
    y1: iosBox.cy + boxH / 2,
    x2: keycloakBox.cx + 40,
    y2: keycloakBox.cy - boxH / 2,
  };

  return (
    <svg
      width="600"
      height="340"
      viewBox="0 0 600 340"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#0d0d1a', borderRadius: 12, padding: 16 }}
      aria-label="Windfire system architecture diagram"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#61dafb" />
        </marker>
      </defs>

      {/* Arrow: windfire-ui-react -> Keycloak */}
      <line
        x1={arrowReact.x1} y1={arrowReact.y1}
        x2={arrowReact.x2} y2={arrowReact.y2}
        stroke="#61dafb" strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
      />
      <text
        x={(arrowReact.x1 + arrowReact.x2) / 2 - 30}
        y={(arrowReact.y1 + arrowReact.y2) / 2}
        style={labelStyle}
      >
        OIDC / OAuth2
      </text>

      {/* Arrow: windfire-ui-ios -> Keycloak */}
      <line
        x1={arrowIos.x1} y1={arrowIos.y1}
        x2={arrowIos.x2} y2={arrowIos.y2}
        stroke="#61dafb" strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
      />
      <text
        x={(arrowIos.x1 + arrowIos.x2) / 2 + 30}
        y={(arrowIos.y1 + arrowIos.y2) / 2}
        style={labelStyle}
      >
        OIDC / OAuth2
      </text>

      {/* Box: windfire-ui-react */}
      <rect
        x={reactBox.cx - boxW / 2} y={reactBox.cy - boxH / 2}
        width={boxW} height={boxH} rx={rx} ry={rx}
        {...clientBoxStyle}
      />
      <text x={reactBox.cx} y={reactBox.cy - 10} style={textStyle}>
        windfire-ui-react
      </text>
      <text x={reactBox.cx} y={reactBox.cy + 12} style={subtextStyle}>
        Browser UI
      </text>

      {/* Box: windfire-ui-ios */}
      <rect
        x={iosBox.cx - boxW / 2} y={iosBox.cy - boxH / 2}
        width={boxW} height={boxH} rx={rx} ry={rx}
        {...clientBoxStyle}
      />
      <text x={iosBox.cx} y={iosBox.cy - 10} style={textStyle}>
        windfire-ui-ios
      </text>
      <text x={iosBox.cx} y={iosBox.cy + 12} style={subtextStyle}>
        Native iPhone UI
      </text>

      {/* Box: Keycloak */}
      <rect
        x={keycloakBox.cx - boxW / 2} y={keycloakBox.cy - boxH / 2}
        width={boxW} height={boxH} rx={rx} ry={rx}
        {...keycloakBoxStyle}
      />
      <text x={keycloakBox.cx} y={keycloakBox.cy - 10} style={{ ...textStyle, fill: '#90ee90' }}>
        Keycloak
      </text>
      <text x={keycloakBox.cx} y={keycloakBox.cy + 12} style={subtextStyle}>
        Authentication Server
      </text>
    </svg>
  );
}

export default ArchitectureDiagram;
