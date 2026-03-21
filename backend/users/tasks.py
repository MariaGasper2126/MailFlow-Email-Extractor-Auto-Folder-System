from celery import shared_task
from django.contrib.auth.models import User
from .services import EmailProcessor, delete_old_attachments

@shared_task(bind=True)
def extract_emails_task(self, user_id):
    try:
        user = User.objects.get(id=user_id)
        
        # Initialize processor
        processor = EmailProcessor(user)
        
        # Optional: update state to "Connecting"
        self.update_state(state='PROGRESS', meta={'status': 'Connecting to Gmail...'})
        processor.connect()
        
        # Process emails
        self.update_state(state='PROGRESS', meta={'status': 'Extracting emails...'})
        processed, saved = processor.process_unseen_emails()
        
        # Cleanup
        self.update_state(state='PROGRESS', meta={'status': 'Cleaning up old files...'})
        delete_old_attachments(user)
        
        processor.disconnect()
        
        return {
            'success': True,
            'emails_processed': processed,
            'attachments_saved': saved
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
