import nltk
from rake_nltk import Rake

# Ensure necessary NLTK data is available (already downloaded in previous step,
# but good practice for scripts that might be run in different environments)
# However, calling download here can be problematic in restricted environments or if run frequently.
# Assuming they are present from the initial setup.
# try:
#     nltk.data.find('corpora/stopwords')
# except nltk.downloader.DownloadError:
#     nltk.download('stopwords', quiet=True)
# try:
#     nltk.data.find('tokenizers/punkt')
# except nltk.downloader.DownloadError:
#     nltk.download('punkt', quiet=True)

def extract_keywords(text: str, max_keywords: int = 10) -> str:
    """
    Extracts keywords from the given text using Rake (Rapid Automatic Keyword Extraction).

    Args:
        text: The input string from which to extract keywords.
        max_keywords: The maximum number of keywords to return.

    Returns:
        A comma-separated string of keywords, or an empty string if no keywords
        are found or an error occurs.
    """
    if not text or not text.strip():
        return ""

    try:
        r = Rake()
        r.extract_keywords_from_text(text)
        # Get ranked phrases (keywords). Each phrase is a list of words.
        # We'll take the top `max_keywords` phrases.
        ranked_phrases = r.get_ranked_phrases_with_scores()

        # Filter out phrases with low scores (e.g., score < 2) or single-character words,
        # though Rake usually handles this well.
        # For this task, we'll directly take the top phrases.

        keywords = []
        for score, phrase in ranked_phrases:
            if len(keywords) < max_keywords:
                # Rake can sometimes return phrases with words that are part of stopwords if they form a meaningful phrase.
                # For simplicity, we'll join them as they are.
                keywords.append(phrase)
            else:
                break

        return ", ".join(keywords)
    except Exception as e:
        # Log the error (in a real application, use proper logging)
        print(f"Error during keyword extraction: {e}")
        # Optionally, could try to ensure NLTK resources are present here if a specific error occurs
        # For example, if LookupError for 'stopwords' or 'punkt'
        if isinstance(e, LookupError) and ('stopwords' in str(e) or 'punkt' in str(e)):
            print("NLTK resource missing. Please ensure 'stopwords' and 'punkt' are downloaded.")
        return ""

if __name__ == '__main__':
    # Example Usage (for testing this script directly)
    # Ensure NLTK data is downloaded before running this test
    try:
        nltk.data.find('corpora/stopwords')
        nltk.data.find('tokenizers/punkt')
    except LookupError as e:
        print(f"Missing NLTK data for testing: {e}. Downloading...")
        if 'stopwords' in str(e):
            nltk.download('stopwords')
        if 'punkt' in str(e):
            nltk.download('punkt')
        print("Downloads finished. Please re-run the test if it failed due to missing data.")


    sample_text_1 = "Natural Language Processing (NLP) is a subfield of artificial intelligence. It focuses on enabling computers to understand and process human language."
    keywords_1 = extract_keywords(sample_text_1)
    print(f"Text: {sample_text_1}")
    print(f"Keywords: {keywords_1}")

    sample_text_2 = "Another example with some common words. This is a simple test."
    keywords_2 = extract_keywords(sample_text_2, max_keywords=5)
    print(f"Text: {sample_text_2}")
    print(f"Keywords: {keywords_2}")

    sample_text_3 = "" # Empty text
    keywords_3 = extract_keywords(sample_text_3)
    print(f"Text: {sample_text_3}")
    print(f"Keywords: {keywords_3}")

    sample_text_4 = "Python programming is fun and versatile."
    keywords_4 = extract_keywords(sample_text_4)
    print(f"Text: {sample_text_4}")
    print(f"Keywords: {keywords_4}")
