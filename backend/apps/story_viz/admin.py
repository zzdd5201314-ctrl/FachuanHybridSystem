"""
StoryViz Admin 层 - 纯重导出文件

所有 Admin 定义位于 admin/ 子目录中。
本文件仅做重导出，保持向后兼容性。
"""

from __future__ import annotations

from apps.story_viz.admin import *  # noqa: F403
from apps.story_viz.admin import __all__ as __all__
