import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // For extended matchers like toBeInTheDocument
import VideoCard from './VideoCard';
import recommenderService from '../services/recommenderService';

// Mock the recommenderService
// For Vitest, use vi.mock:
// import { vi } from 'vitest';
// vi.mock('../services/recommenderService', () => ({
//   default: { // if recommenderService is a default export
//     likeVideo: vi.fn(),
//     markAsWatched: vi.fn(),
//   }
// }));
// For Jest (if this environment implies Jest):
jest.mock('../services/recommenderService', () => ({
  likeVideo: jest.fn(),
  markAsWatched: jest.fn(),
  // Ensure all functions used by the component are mocked if it's a default export
  // or if you are mocking the entire module path.
}));


// Mock window.alert as it's used in the component
global.alert = jest.fn();

describe('VideoCard Component', () => {
    const mockVideo = {
        id: '1',
        title: 'Test Video Title',
        description: 'A great description for a test video that might be a bit long to see if truncation works.',
        uploader_username: 'TestUploader',
        tags: 'test,video,react',
    };

    beforeEach(() => {
        // Clear mocks before each test
        recommenderService.likeVideo.mockClear();
        recommenderService.markAsWatched.mockClear();
        global.alert.mockClear();
    });

    test('renders video information correctly', () => {
        render(<VideoCard video={mockVideo} />);
        expect(screen.getByText(mockVideo.title)).toBeInTheDocument();
        // Description might be truncated, so check for partial content or use a more robust query
        expect(screen.getByText((content, element) => content.startsWith('A great description'))).toBeInTheDocument();
        expect(screen.getByText(`Uploaded by: ${mockVideo.uploader_username}`)).toBeInTheDocument();
        expect(screen.getByText(`Tags: test, video, react`)).toBeInTheDocument(); // Assuming tags are split and joined
    });

    test('renders "No description available." if description is null/undefined', () => {
        render(<VideoCard video={{ ...mockVideo, description: null }} />);
        expect(screen.getByText("No description available.")).toBeInTheDocument();
    });

    test('renders "Unknown Uploader" if uploader_username is null/undefined', () => {
        render(<VideoCard video={{ ...mockVideo, uploader_username: null }} />);
        expect(screen.getByText("Uploaded by: Unknown")).toBeInTheDocument();
    });

    test('calls likeVideo service on "Like" button click and alerts success', async () => {
        recommenderService.likeVideo.mockResolvedValue({ success: true });

        render(<VideoCard video={mockVideo} />);
        fireEvent.click(screen.getByRole('button', { name: /like/i }));

        expect(recommenderService.likeVideo).toHaveBeenCalledWith(mockVideo.id);
        await waitFor(() => {
            expect(global.alert).toHaveBeenCalledWith(`Liked "${mockVideo.title}"! Interaction sent.`);
        });
    });

    test('calls markAsWatched service on "Mark Watched" button click and alerts success', async () => {
        recommenderService.markAsWatched.mockResolvedValue({ success: true });

        render(<VideoCard video={mockVideo} />);
        fireEvent.click(screen.getByRole('button', { name: /mark watched/i }));

        expect(recommenderService.markAsWatched).toHaveBeenCalledWith(mockVideo.id, 180);
         await waitFor(() => {
            expect(global.alert).toHaveBeenCalledWith(`Marked "${mockVideo.title}" as watched! Interaction sent.`);
        });
    });

    test('alerts error if likeVideo service fails', async () => {
        recommenderService.likeVideo.mockRejectedValue(new Error('Failed to like'));
        render(<VideoCard video={mockVideo} />);
        fireEvent.click(screen.getByRole('button', { name: /like/i }));
        await waitFor(() => {
            expect(global.alert).toHaveBeenCalledWith('Error liking video: Failed to like');
        });
    });

    test('alerts error if markAsWatched service fails', async () => {
        recommenderService.markAsWatched.mockRejectedValue(new Error('Failed to mark watched'));
        render(<VideoCard video={mockVideo} />);
        fireEvent.click(screen.getByRole('button', { name: /mark watched/i }));
        await waitFor(() => {
            expect(global.alert).toHaveBeenCalledWith('Error marking as watched: Failed to mark watched');
        });
    });

    test('does not render if video prop is null or undefined', () => {
        const { container } = render(<VideoCard video={null} />);
        // When returning null, container.firstChild will be null, or container will be empty.
        expect(container.firstChild).toBeNull();
    });
});
