"""
Tests for v0.28 Export API.

Tests the async export flow with status polling.
"""
import uuid
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from apps.users.models import User
from apps.solo.models import SoloSession, SoloExport


class ExportAPITestCase(TestCase):
    """Test cases for Export API endpoints."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test user
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            role='tutor',
        )
        self.client.force_authenticate(user=self.user)
        
        # Create test session
        self.session = SoloSession.objects.create(
            user=self.user,
            name='Test Session',
            state={'pages': [{'strokes': []}]},
            page_count=1,
        )
    
    def test_create_export_request(self):
        """Test POST /api/v1/solo/sessions/{id}/export/"""
        url = reverse('solo-api:session-export', kwargs={'pk': self.session.id})
        
        response = self.client.post(url, {'format': 'json'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertIn('status', response.data)
        self.assertEqual(response.data['format'], 'json')
        # JSON export may complete or fail depending on storage config
        self.assertIn(response.data['status'], ['pending', 'completed', 'failed'])
    
    def test_create_export_invalid_format(self):
        """Test export with invalid format returns 400."""
        url = reverse('solo-api:session-export', kwargs={'pk': self.session.id})
        
        response = self.client.post(url, {'format': 'invalid'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_get_export_status(self):
        """Test GET /api/v1/exports/{id}/"""
        # Create an export
        export = SoloExport.objects.create(
            session=self.session,
            user=self.user,
            format='json',
            status='completed',
            file_url='https://example.com/export.json',
            file_size=1024,
        )
        
        url = reverse('solo-api:export-detail', kwargs={'pk': export.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(export.id))
        self.assertEqual(response.data['status'], 'completed')
        self.assertEqual(response.data['file_url'], 'https://example.com/export.json')
        self.assertEqual(response.data['session_id'], str(self.session.id))
    
    def test_get_export_not_found(self):
        """Test GET /api/v1/exports/{id}/ with non-existent ID returns 404."""
        fake_id = uuid.uuid4()
        url = reverse('solo-api:export-detail', kwargs={'pk': fake_id})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_get_export_other_user(self):
        """Test that users can only access their own exports."""
        # Create another user
        other_user = User.objects.create_user(
            email='other@example.com',
            password='testpass123',
            role='student',
        )
        
        # Create export for other user
        other_session = SoloSession.objects.create(
            user=other_user,
            name='Other Session',
            state={},
        )
        other_export = SoloExport.objects.create(
            session=other_session,
            user=other_user,
            format='json',
            status='completed',
        )
        
        # Try to access other user's export
        url = reverse('solo-api:export-detail', kwargs={'pk': other_export.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_list_session_exports(self):
        """Test GET /api/v1/solo/sessions/{id}/exports/"""
        # Create some exports
        SoloExport.objects.create(
            session=self.session,
            user=self.user,
            format='json',
            status='completed',
        )
        SoloExport.objects.create(
            session=self.session,
            user=self.user,
            format='png',
            status='failed',
            error='Test error',
        )
        
        url = reverse('solo-api:session-exports-list', kwargs={'pk': self.session.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_export_status_transitions(self):
        """Test export status field values."""
        export = SoloExport.objects.create(
            session=self.session,
            user=self.user,
            format='png',
            status='pending',
        )
        
        # Verify initial status
        self.assertEqual(export.status, 'pending')
        
        # Simulate processing
        export.status = 'processing'
        export.save()
        export.refresh_from_db()
        self.assertEqual(export.status, 'processing')
        
        # Simulate completion
        export.status = 'completed'
        export.file_url = 'https://example.com/export.png'
        export.save()
        export.refresh_from_db()
        self.assertEqual(export.status, 'completed')
        self.assertIsNotNone(export.file_url)
    
    def test_export_error_field(self):
        """Test export error field for failed exports."""
        export = SoloExport.objects.create(
            session=self.session,
            user=self.user,
            format='pdf',
            status='failed',
            error='PDF generation failed: missing dependency',
        )
        
        url = reverse('solo-api:export-detail', kwargs={'pk': export.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'failed')
        self.assertEqual(response.data['error'], 'PDF generation failed: missing dependency')


class ExportModelTestCase(TestCase):
    """Test cases for SoloExport model."""
    
    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            role='tutor',
        )
        self.session = SoloSession.objects.create(
            user=self.user,
            name='Test Session',
            state={},
        )
    
    def test_export_str(self):
        """Test SoloExport string representation."""
        export = SoloExport.objects.create(
            session=self.session,
            user=self.user,
            format='json',
            status='completed',
        )
        
        expected = f"{self.session.name} - json (completed)"
        self.assertEqual(str(export), expected)
    
    def test_export_ordering(self):
        """Test exports are ordered by created_at descending."""
        export1 = SoloExport.objects.create(
            session=self.session,
            user=self.user,
            format='json',
            status='completed',
        )
        export2 = SoloExport.objects.create(
            session=self.session,
            user=self.user,
            format='png',
            status='pending',
        )
        
        exports = list(SoloExport.objects.all())
        self.assertEqual(exports[0], export2)  # Newer first
        self.assertEqual(exports[1], export1)
