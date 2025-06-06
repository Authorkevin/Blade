from django.contrib import admin
from .models import Ad

@admin.register(Ad)
class AdAdmin(admin.ModelAdmin):
    list_display = (
        'ad_title',
        'creator_username_display', # Use a custom method to display username
        'media_type',
        'status',
        'budget',
        'created_at',
        'updated_at'
    )
    list_filter = ('status', 'media_type', 'created_at', 'target_gender', 'target_device')
    search_fields = ('ad_title', 'ad_copy', 'creator__username', 'keywords') # Search by related field
    readonly_fields = ('stripe_payment_id', 'created_at', 'updated_at') # Fields not to be edited directly in admin for safety

    fieldsets = (
        (None, {
            'fields': ('ad_title', 'creator', 'ad_copy', 'target_url', 'button_text')
        }),
        ('Media', {
            'fields': ('media_type', 'media_file')
        }),
        ('Targeting', {
            'fields': ('keywords', 'target_age_min', 'target_age_max', 'target_gender', 'target_device', 'target_time_of_day_start', 'target_time_of_day_end', 'target_region')
        }),
        ('Budget & Status', {
            'fields': ('budget', 'status', 'stripe_payment_id')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',) # Collapsible section
        }),
    )

    def creator_username_display(self, obj):
        return obj.creator.username
    creator_username_display.short_description = 'Creator' # Column header

    # Optional: If you want to make 'creator' field readonly after creation
    # def get_readonly_fields(self, request, obj=None):
    #     if obj: # obj is not None, so it's an edit page
    #         return self.readonly_fields + ('creator',)
    #     return self.readonly_fields

    # Actions
    def approve_ads(self, request, queryset):
        queryset.update(status='live')
    approve_ads.short_description = "Approve selected ads (set status to Live)"

    def reject_ads(self, request, queryset):
        queryset.update(status='rejected')
    reject_ads.short_description = "Reject selected ads (set status to Rejected)"

    actions = ['approve_ads', 'reject_ads']

admin.site.site_header = "My Project Admin" # Optional: Custom admin site header
admin.site.site_title = "My Project Admin Portal" # Optional: Custom admin site title
admin.site.index_title = "Welcome to My Project Admin Portal" # Optional: Custom admin index title
