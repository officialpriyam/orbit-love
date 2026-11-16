"""Expose the existing FastAPI application at a Vercel-recognized entrypoint."""
from matching.main import app

__all__ = ['app']
