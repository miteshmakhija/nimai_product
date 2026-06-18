import io
from docxtpl import DocxTemplate


def render_template(template_blob: bytes, context: dict) -> bytes:
    tpl = DocxTemplate(io.BytesIO(template_blob))
    tpl.render(context)
    buf = io.BytesIO()
    tpl.save(buf)
    return buf.getvalue()
