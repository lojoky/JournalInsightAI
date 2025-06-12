# FastAPI Project Skeleton

A Python 3.12 FastAPI project with SQLAlchemy, OpenAI integration, and file processing capabilities.

## Features

- **FastAPI** web framework with automatic API documentation
- **SQLAlchemy** ORM for database operations
- **OpenAI** integration (v1.30.0+)
- **File upload** support with multipart form data
- **Image processing** with Pillow and ImageHash
- **Vector search** with FAISS-CPU
- **Date parsing** with dateparser
- **Environment configuration** with python-dotenv
- **CORS** enabled for cross-origin requests

## Dependencies

- `fastapi` - Modern web framework
- `uvicorn` - ASGI server
- `openai>=1.30.0` - OpenAI API client
- `python-multipart` - Form data parsing
- `aiofiles` - Async file operations
- `pillow` - Image processing
- `imagehash` - Perceptual image hashing
- `dateparser` - Natural language date parsing
- `pydantic` - Data validation
- `sqlalchemy` - SQL toolkit and ORM
- `faiss-cpu` - Vector similarity search
- `python-dotenv` - Environment variable management

## Setup

1. **Install dependencies** (already done via packager):
   ```bash
   # Dependencies are installed in .pythonlibs virtual environment
   ```

2. **Configure environment variables**:
   Edit `.env` file with your configuration:
   ```bash
   DATABASE_URL=sqlite:///./app.db
   OPENAI_API_KEY=your_openai_api_key_here
   DEBUG=True
   ```

3. **Run the application**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 3000 --reload
   ```

## Project Structure

```
.
├── main.py          # FastAPI application entry point
├── db.py            # SQLAlchemy database configuration
├── .env             # Environment variables
├── README.md        # This file
└── app.db           # SQLite database (created automatically)
```

## API Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `POST /upload` - File upload example
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation

## Development

The application includes:

- **Automatic database table creation** on startup
- **CORS middleware** for cross-origin requests
- **File upload validation** example
- **Environment-based configuration**
- **SQLAlchemy session management**

## Usage Examples

### Basic API Call
```bash
curl http://localhost:3000/
```

### File Upload
```bash
curl -X POST "http://localhost:3000/upload" \
     -H "accept: application/json" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@example.jpg"
```

### Access API Documentation
Open your browser to:
- Swagger UI: http://localhost:3000/docs
- ReDoc: http://localhost:3000/redoc

## Extending the Project

1. **Add new models** in `db.py`
2. **Create new endpoints** in `main.py` or separate route files
3. **Configure additional services** in `.env`
4. **Add business logic** in separate modules

## Production Deployment

For production deployment:

1. Set `DEBUG=False` in `.env`
2. Use a production database (PostgreSQL recommended)
3. Configure proper CORS origins
4. Add authentication and authorization
5. Use a production ASGI server configuration