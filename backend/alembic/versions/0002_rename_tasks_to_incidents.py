"""Rename TaskBoard records to OpsDesk incidents.

Revision ID: 0002_rename_tasks_to_incidents
Revises: 0001_create_tasks
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_rename_tasks_to_incidents"
down_revision = "0001_create_tasks"
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table("tasks", "incidents")
    op.execute(sa.text("UPDATE incidents SET status = 'OPEN' WHERE status = 'TODO'"))
    op.execute(sa.text("UPDATE incidents SET status = 'RESOLVED' WHERE status = 'DONE'"))


def downgrade():
    op.execute(sa.text("UPDATE incidents SET status = 'TODO' WHERE status = 'OPEN'"))
    op.execute(sa.text("UPDATE incidents SET status = 'DONE' WHERE status = 'RESOLVED'"))
    op.rename_table("incidents", "tasks")
