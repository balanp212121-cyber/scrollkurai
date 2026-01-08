
export function HardFallbackScreen({ message = "Loading..." }: { message?: string }) {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f0f23',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
                <h1 style={{ color: '#8b5cf6', marginBottom: '1rem' }}>ScrollKurai</h1>
                <p>{message}</p>
            </div>
        </div>
    );
}
