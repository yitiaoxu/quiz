import unittest

from extract_handbook import (
    clean_body,
    extract_keypoints,
    parse_toc,
    split_questions,
)


SAMPLE_TEXT = """
目录
一、 FPGA/IC 设计 ............................................................................................................................7
1. 什么叫 FPGA..............................................................................................................................7
2. 什么叫数字 IC ...........................................................................................................................7
3. FPGA 设计流程 .........................................................................................................................7
二、 Verilog 语法 ........................................................................................................................... 42
1. 关键字 ...................................................................................................................................... 42
2. 运算符 ...................................................................................................................................... 42
三、 SystemVerilog ........................................................................................................................ 62
1. 数据类型 .................................................................................................................................. 62
2. Logic 类型 ............................................................................................................................... 62
3. 四值逻辑 .................................................................................................错误!未定义书签。
4. 类 class ..................................................................................................................................... 62

===== PAGE 7 =====
FPGA/数字 IC 设计
仅供学习交流，严禁用于商业用途。
一、 FPGA/IC 设计
1. 什么叫 FPGA
FPGA 是一种可以重构电路的芯片。
如图所示。
2. 什么叫数字 IC
IC 就是半导体元件产品的统称。
3. FPGA 设计流程
主要有以下步骤：
1. 系统规划：定义功能
2. RTL 输入：编写代码
===== PAGE 42 =====
Verilog 语法
仅供学习交流，严禁用于商业用途。
二、 Verilog 语法
1. 关键字


2. 运算符
按其功能可分为以下几类:
1) 算术运算符
2) 赋值运算符
三、 SystemVerilog
1. 数据类型
四值变量：（0、1、x、z）
2. Logic 类型
可以用 logic 代替 reg。
3. 类 class
class 也是一种类型。
"""


class ParseTocTest(unittest.TestCase):
    def test_parse_toc_chapters_and_titles(self):
        toc = parse_toc(SAMPLE_TEXT)
        self.assertEqual(toc[0]["chapter"], "FPGA/IC 设计")
        self.assertEqual(toc[0]["number"], 1)
        self.assertEqual(toc[0]["title"], "什么叫 FPGA")
        self.assertEqual(len([x for x in toc if x["chapter"] == "FPGA/IC 设计"]), 3)
        sv = [x for x in toc if x["chapter"] == "SystemVerilog"]
        self.assertEqual([x["title"] for x in sv], ["数据类型", "Logic 类型", "四值逻辑", "类 class"])


class SplitQuestionsTest(unittest.TestCase):
    def test_nested_numbered_list_stays_in_parent_body(self):
        questions = split_questions(SAMPLE_TEXT)
        flow = next(q for q in questions if q["title"] == "FPGA 设计流程")
        self.assertIn("系统规划", flow["reference"])
        self.assertFalse(any(q["title"].startswith("系统规划") for q in questions))

    def test_empty_body_marked_incomplete(self):
        questions = split_questions(SAMPLE_TEXT)
        keyword = next(q for q in questions if q["title"] == "关键字")
        self.assertTrue(keyword["incomplete"])
        self.assertEqual(keyword["reference"].strip(), "")

    def test_missing_heading_marked_incomplete(self):
        questions = split_questions(SAMPLE_TEXT)
        four = next(q for q in questions if q["title"] == "四值逻辑")
        self.assertTrue(four["incomplete"])

    def test_title_found_even_if_number_differs(self):
        questions = split_questions(SAMPLE_TEXT)
        klass = next(q for q in questions if q["title"] == "类 class")
        self.assertIn("也是一种类型", klass["reference"])
        self.assertFalse(klass["incomplete"])

    def test_figure_note(self):
        questions = split_questions(SAMPLE_TEXT)
        fpga = next(q for q in questions if q["title"] == "什么叫 FPGA")
        self.assertTrue(fpga["hasFigure"])

    def test_ids_use_chapter_and_number(self):
        questions = split_questions(SAMPLE_TEXT)
        fpga = next(q for q in questions if q["title"] == "什么叫 FPGA")
        self.assertEqual(fpga["id"], "1-1")


class CleanBodyTest(unittest.TestCase):
    def test_strips_page_markers_and_copyright(self):
        raw = "仅供学习交流，严禁用于商业用途。\n===== PAGE 8 =====\nFPGA/数字 IC 设计\n正文继续。"
        self.assertEqual(clean_body(raw), "正文继续。")


class KeypointsTest(unittest.TestCase):
    def test_extracts_numbered_items(self):
        body = "主要有：\n1. 系统规划：定义功能\n2. RTL 输入：编写代码\n结束。"
        points = extract_keypoints(body)
        self.assertEqual(points, ["系统规划：定义功能", "RTL 输入：编写代码"])

    def test_paren_style_items(self):
        body = "分类:\n1) 算术运算符\n2) 赋值运算符"
        points = extract_keypoints(body)
        self.assertEqual(points, ["算术运算符", "赋值运算符"])

    def test_single_item_is_not_keypoints(self):
        self.assertEqual(extract_keypoints("只有一句。\n1. 单独一条不够"), [])


if __name__ == "__main__":
    unittest.main()
