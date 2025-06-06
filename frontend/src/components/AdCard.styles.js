const styles = {
    cardStyle: {
        backgroundColor: '#121212', // Darker card background
        color: '#e0e0e0',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '10px',
        marginBottom: '10px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        maxWidth: '500px', // Or whatever width fits your feed
        margin: '10px auto', // Centered if it's a single column, or adjust for grid
        fontFamily: "'Roboto', sans-serif", // Example font
    },
    mediaStyle: {
        width: '100%',
        maxHeight: '300px', // Adjust as needed
        objectFit: 'cover', // Ensures the media covers the area, might crop
        borderRadius: '4px',
        marginBottom: '10px',
        backgroundColor: '#121212', // Placeholder bg for media area
    },
    contentArea: {
        padding: '0 5px', // Some padding if media is full-width to card edge
    },
    adTitleStyle: {
        fontSize: '1.1rem',
        fontWeight: 'bold',
        color: '#bb86fc', // Accent color for title
        marginBottom: '8px',
    },
    sponsoredByStyle: {
        fontSize: '0.8rem',
        color: '#aaa',
        marginBottom: '10px',
        textAlign: 'right',
    },
    sponsoredLink: {
        color: '#bb86fc', // Accent color for the link
        textDecoration: 'none',
        fontWeight: 'bold',
    },
    adCopyStyle: {
        fontSize: '0.95rem',
        lineHeight: '1.4',
        marginBottom: '15px',
        whiteSpace: 'pre-wrap', // Respect newlines in ad copy
    },
    buttonStyle: {
        display: 'block',
        width: '100%',
        padding: '10px 0',
        backgroundColor: '#bb86fc', // Accent color button
        color: '#121212', // Dark text on light button
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '1rem',
        transition: 'background-color 0.2s ease',
    },
    // Add hover effect for button if desired
    // buttonHoverStyle: {
    //     backgroundColor: '#a06cd5', // Slightly darker on hover
    // }
};

// If using a framework like Material UI or styled-components, this would be different.
// This is for plain React inline styles or CSS modules pattern.

export default styles;
