"""
Thumbnail generation for Solo sessions.
"""
import io
import logging
from typing import Optional

logger = logging.getLogger('solo.thumbnail')


class ThumbnailService:
    """Service for generating session thumbnails."""
    
    THUMBNAIL_SIZE = (400, 300)
    BACKGROUND_COLOR = (255, 255, 255)
    
    @staticmethod
    def generate_from_state(state: dict) -> io.BytesIO:
        """
        Generate thumbnail from session state.
        
        This is a simplified version - renders strokes/shapes
        onto a small canvas.
        """
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            logger.warning("Pillow not installed, returning placeholder thumbnail")
            return ThumbnailService._create_placeholder()
        
        img = Image.new('RGB', ThumbnailService.THUMBNAIL_SIZE, ThumbnailService.BACKGROUND_COLOR)
        draw = ImageDraw.Draw(img)
        
        # Get first page
        pages = state.get('pages', [state])
        if not pages:
            return ThumbnailService._save_image(img)
        
        page = pages[0] if isinstance(pages, list) else pages
        
        # Scale factor (assuming original canvas is 1920x1080)
        scale_x = ThumbnailService.THUMBNAIL_SIZE[0] / 1920
        scale_y = ThumbnailService.THUMBNAIL_SIZE[1] / 1080
        
        # Draw strokes
        for stroke in page.get('strokes', []):
            points = stroke.get('points', [])
            if len(points) < 2:
                continue
            
            color = stroke.get('color', '#000000')
            # Convert hex to RGB
            if isinstance(color, str) and color.startswith('#'):
                try:
                    color = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
                except ValueError:
                    color = (0, 0, 0)
            
            scaled_points = []
            for p in points:
                if isinstance(p, dict):
                    scaled_points.append((p.get('x', 0) * scale_x, p.get('y', 0) * scale_y))
                elif isinstance(p, (list, tuple)) and len(p) >= 2:
                    scaled_points.append((p[0] * scale_x, p[1] * scale_y))
            
            if len(scaled_points) >= 2:
                width = max(1, int(stroke.get('size', 2) * scale_x))
                draw.line(scaled_points, fill=color, width=width)
        
        # Draw shapes
        for shape in page.get('shapes', []):
            color = shape.get('color', '#000000')
            if isinstance(color, str) and color.startswith('#'):
                try:
                    color = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
                except ValueError:
                    color = (0, 0, 0)
            
            x1 = shape.get('startX', 0) * scale_x
            y1 = shape.get('startY', 0) * scale_y
            x2 = shape.get('endX', 0) * scale_x
            y2 = shape.get('endY', 0) * scale_y
            
            shape_type = shape.get('type')
            if shape_type == 'rectangle':
                draw.rectangle([x1, y1, x2, y2], outline=color)
            elif shape_type == 'circle' or shape_type == 'ellipse':
                draw.ellipse([x1, y1, x2, y2], outline=color)
            elif shape_type == 'line':
                draw.line([x1, y1, x2, y2], fill=color)
        
        return ThumbnailService._save_image(img)
    
    @staticmethod
    def _save_image(img) -> io.BytesIO:
        """Save image to BytesIO."""
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        return buffer
    
    @staticmethod
    def _create_placeholder() -> io.BytesIO:
        """Create a placeholder thumbnail when Pillow is not available."""
        # Return a minimal valid PNG
        buffer = io.BytesIO()
        # Minimal 1x1 white PNG
        buffer.write(bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ]))
        buffer.seek(0)
        return buffer
    
    @staticmethod
    def generate_and_upload(session) -> Optional[str]:
        """Generate thumbnail and upload to storage."""
        from apps.solo.services.storage import SoloStorageService
        
        try:
            thumbnail = ThumbnailService.generate_from_state(session.state)
            
            storage = SoloStorageService()
            url = storage.upload_thumbnail(str(session.id), thumbnail)
            
            # Update session
            session.thumbnail_url = url
            session.save(update_fields=['thumbnail_url', 'updated_at'])
            
            return url
        except Exception as e:
            logger.error(f"Failed to generate thumbnail for {session.id}: {e}")
            return None
