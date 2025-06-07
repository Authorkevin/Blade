const styles = {
    pageContainer: {
        padding: '20px',
        fontFamily: "'Roboto', sans-serif",
        color: '#e0e0e0',
        backgroundColor: '#121212', // Dark background for the page
        minHeight: '100vh',
    },
    heading: {
        color: '#bb86fc', // Accent color
        textAlign: 'center',
        fontSize: '2em',
        marginBottom: '30px',
    },
    loadingMessage: {
        textAlign: 'center',
        fontSize: '1.2em',
        color: '#03dac5', // Another accent color
    },
    errorMessage: {
        textAlign: 'center',
        fontSize: '1.2em',
        color: '#cf6679', // Error color
        padding: '20px',
        backgroundColor: '#2e2e2e',
        borderRadius: '8px',
        border: '1px solid #cf6679',
    },
    infoMessage: {
        textAlign: 'center',
        fontSize: '1.1em',
        color: '#aaa',
    },
    link: {
        color: '#bb86fc',
        textDecoration: 'none',
        fontWeight: 'bold',
    },
    tableContainer: {
        overflowX: 'auto', // For responsiveness on small screens
        backgroundColor: '#1e1e1e', // Slightly lighter dark for table container
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        color: '#e0e0e0',
    },
    th: {
        backgroundColor: '#333333', // Darker header for table
        color: '#bb86fc', // Accent color for table headers
        padding: '12px 15px',
        textAlign: 'left',
        borderBottom: '2px solid #444',
        fontSize: '1rem',
        textTransform: 'uppercase',
    },
    td: {
        padding: '10px 15px',
        borderBottom: '1px solid #444', // Separator for rows
        fontSize: '0.95rem',
    },
    tr: {
        '&:nth-of-type(even)': { // For zebra striping if desired, but direct JS styles don't support pseudo-classes easily
            // backgroundColor: '#2a2a2a', // Example for even rows, would need to apply conditionally or use CSS classes
        },
        '&:hover': {
            // backgroundColor: '#313131', // Example for hover, needs CSS classes or JS event handlers
        },
    },
    // To achieve hover and nth-child effects reliably, consider using CSS modules or a styled-components approach
    // For this basic JS styling, these are illustrative. Actual hover/striping might be omitted or done differently.

    // Styles for action messages
    successMessage: {
        padding: '10px',
        margin: '15px 0',
        border: '1px solid #03dac5',
        borderRadius: '4px',
        backgroundColor: '#1A3A3A', // Darker green for success background
        color: '#03dac5', // Success text color
        textAlign: 'center',
    },
    // Error message style is already defined, can be reused or a specific one for actions if needed

    // Styles for action buttons in table
    actionButton: {
        padding: '6px 12px',
        marginRight: '8px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.85rem',
        transition: 'opacity 0.2s ease',
        minWidth: '70px', // Ensure buttons have some minimum width
        textAlign: 'center',
    },
    pauseButton: {
        backgroundColor: '#ffc107', // Amber/yellow for pause
        color: '#121212',
    },
    resumeButton: {
        backgroundColor: '#4caf50', // Green for resume/live
        color: '#ffffff',
    },
    deleteButton: {
        backgroundColor: '#f44336', // Red for delete
        color: '#ffffff',
    },
    editButton: { // New style for Edit button
        backgroundColor: '#2196f3', // Blue, similar to 'pending_approval' or a common edit color
        color: '#ffffff',
        textDecoration: 'none', // Remove underline from Link if styled as button
        display: 'inline-block', // Ensure proper layout when Link is styled as button
    },

    // Status indicators in table
    statusIndicator: {
        default: { padding: '3px 7px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', color: '#121212' },
        pending_review:   { backgroundColor: '#ffc107', color: '#121212' }, // Yellow
        pending_approval: { backgroundColor: '#2196f3', color: '#ffffff' }, // Blue
        live:             { backgroundColor: '#4caf50', color: '#ffffff' }, // Green
        paused:           { backgroundColor: '#757575', color: '#ffffff' }, // Grey
        completed:        { backgroundColor: '#607d8b', color: '#ffffff' }, // Blue Grey
        rejected:         { backgroundColor: '#f44336', color: '#ffffff' }, // Red
    }
};

// To use statusIndicator: <span style={{...styles.statusIndicator.default, ...styles.statusIndicator[ad.status]}}>Text</span>

export default styles;
