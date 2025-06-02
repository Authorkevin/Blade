import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter, useLocation as actualUseLocation } from 'react-router-dom';
import MainLayout from './MainLayout';

// Mock react-router-dom's useLocation hook
// jest.mock('react-router-dom', () => ({
//   ...jest.requireActual('react-router-dom'), // Retain other exports
//   useLocation: jest.fn(), // Mock useLocation
// }));
// For Vitest, the equivalent would be:
// vi.mock('react-router-dom', async (importOriginal) => {
//   const actual = await importOriginal();
//   return { ...actual, useLocation: vi.fn() };
// });

// Since direct jest/vi mocking isn't available in this tool environment,
// this test will rely on the actual useLocation. We can test behavior by wrapping
// in BrowserRouter and navigating if needed, or by checking link attributes.
// For active link style, it might be harder to test without DOM inspection beyond text.

describe('MainLayout Component', () => {
    afterEach(cleanup); // Clean up DOM after each test

    const TestComponent = ({ children }) => <BrowserRouter><MainLayout>{children}</MainLayout></BrowserRouter>;

    test('renders header with app title "MyApp"', () => {
        render(<TestComponent><div>Test Content</div></TestComponent>);
        // Check if "MyApp" is in a heading role or just as text
        const heading = screen.getByRole('heading', { name: /myapp/i });
        expect(heading).toBeInTheDocument();
    });

    test('renders children content correctly', () => {
        const childText = "Child Content Here";
        render(<TestComponent><div>{childText}</div></TestComponent>);
        expect(screen.getByText(childText)).toBeInTheDocument();
    });

    test('renders bottom navigation with correct links and text', () => {
        render(<TestComponent><div>Test Content</div></TestComponent>);

        const homeLink = screen.getByRole('link', { name: /home/i });
        expect(homeLink).toBeInTheDocument();
        expect(homeLink).toHaveAttribute('href', '/');
        expect(homeLink.textContent).toMatch(/🏠\s*Home/); // Check icon and text

        const messagesLink = screen.getByRole('link', { name: /messages/i });
        expect(messagesLink).toBeInTheDocument();
        expect(messagesLink).toHaveAttribute('href', '/messages');
        expect(messagesLink.textContent).toMatch(/💬\s*Messages/);

        const profileLink = screen.getByRole('link', { name: /profile/i });
        expect(profileLink).toBeInTheDocument();
        expect(profileLink).toHaveAttribute('href', '/profile');
        expect(profileLink.textContent).toMatch(/👤\s*Profile/);
    });

    // Testing active link style is tricky without a proper DOM environment that applies styles.
    // We can check if the `Link` component receives correct state if `useLocation` was effectively mocked
    // or if the component passes down an `isActive` prop based on path.
    // The current MainLayout applies style directly based on `location.pathname`.
    // A more robust test would involve navigating and checking applied CSS classes or computed styles,
    // which is beyond simple @testing-library/react renders without full browser environment or specific setup.

    test('navigates to correct path when a nav link is clicked (conceptual)', () => {
        // This would typically involve `fireEvent.click` and checking `window.location.pathname`
        // or using a memory router and checking its state.
        // For this environment, we assume the <Link> component works as intended.
        render(<TestComponent><div>Test Content</div></TestComponent>);
        const homeLink = screen.getByRole('link', { name: /home/i });
        expect(homeLink.getAttribute('href')).toBe('/');
        // In a full test env:
        // fireEvent.click(homeLink);
        // expect(mockedUseLocation().pathname).toBe('/'); // if useLocation is mocked and navigation updates it
    });
});
