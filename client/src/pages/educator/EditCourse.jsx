import React, { useContext, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { assets } from '../../assets/assets';
import { toast } from 'react-toastify'
import Quill from 'quill';
import uniqid from 'uniqid';
import axios from 'axios'
import { AppContext } from '../../context/AppContext';
import Loading from '../../components/student/Loading';

const EditCourse = () => {

  const { courseId } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const quillRef = useRef(null);

  const { backendUrl, getToken } = useContext(AppContext)

  const [loading, setLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState('')
  const [coursePrice, setCoursePrice] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [image, setImage] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState('')
  const [chapters, setChapters] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentChapterId, setCurrentChapterId] = useState(null);
  const [editingLecture, setEditingLecture] = useState(null);
  const [lectureDetails, setLectureDetails] = useState({
    lectureTitle: '',
    lectureDuration: '',
    lectureUrl: '',
    isPreviewFree: false,
  });

  // Fetch course data for editing
  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        const token = await getToken();
        const { data } = await axios.get(
          `${backendUrl}/api/educator/course/${courseId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success) {
          const course = data.course;
          setCourseTitle(course.courseTitle);
          setCoursePrice(course.coursePrice);
          setDiscount(course.discount);
          setExistingImageUrl(course.courseThumbnail);
          setChapters(course.courseContent || []);
          
          // Set description in Quill editor once it's initialized
          if (quillRef.current) {
            quillRef.current.root.innerHTML = course.courseDescription;
          }
        } else {
          toast.error(data.message);
          navigate('/educator/my-courses');
        }
      } catch (error) {
        toast.error('Failed to fetch course data');
        navigate('/educator/my-courses');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchCourseData();
    }
  }, [courseId, backendUrl, getToken, navigate]);

  const handleChapter = (action, chapterId) => {
    if (action === 'add') {
      const title = prompt('Enter Chapter Name:');
      if (title) {
        const newChapter = {
          chapterId: uniqid(),
          chapterTitle: title,
          chapterContent: [],
          collapsed: false,
          chapterOrder: chapters.length > 0 ? Math.max(...chapters.map(ch => ch.chapterOrder || 0)) + 1 : 1,
        };
        setChapters([...chapters, newChapter]);
      }
    } else if (action === 'remove') {
      setChapters(chapters.filter((chapter) => chapter.chapterId !== chapterId));
    } else if (action === 'toggle') {
      setChapters(
        chapters.map((chapter) =>
          chapter.chapterId === chapterId ? { ...chapter, collapsed: !chapter.collapsed } : chapter
        )
      );
    }
  };

  const handleLecture = (action, chapterId, lectureIndex) => {
    if (action === 'add') {
      setCurrentChapterId(chapterId);
      setEditingLecture(null);
      setLectureDetails({
        lectureTitle: '',
        lectureDuration: '',
        lectureUrl: '',
        isPreviewFree: false,
      });
      setShowPopup(true);
    } else if (action === 'edit') {
      const chapter = chapters.find(ch => ch.chapterId === chapterId);
      const lecture = chapter.chapterContent[lectureIndex];
      setCurrentChapterId(chapterId);
      setEditingLecture({ chapterId, lectureIndex });
      setLectureDetails({
        lectureTitle: lecture.lectureTitle,
        lectureDuration: lecture.lectureDuration,
        lectureUrl: lecture.lectureUrl,
        isPreviewFree: lecture.isPreviewFree,
      });
      setShowPopup(true);
    } else if (action === 'remove') {
      setChapters(
        chapters.map((chapter) => {
          if (chapter.chapterId === chapterId) {
            const updatedContent = [...chapter.chapterContent];
            updatedContent.splice(lectureIndex, 1);
            return { ...chapter, chapterContent: updatedContent };
          }
          return chapter;
        })
      );
    }
  };

  const addOrUpdateLecture = () => {
    setChapters(
      chapters.map((chapter) => {
        if (chapter.chapterId === currentChapterId) {
          if (editingLecture) {
            // Update existing lecture
            const updatedContent = [...chapter.chapterContent];
            updatedContent[editingLecture.lectureIndex] = {
              ...lectureDetails,
              lectureOrder: updatedContent[editingLecture.lectureIndex].lectureOrder,
              lectureId: updatedContent[editingLecture.lectureIndex].lectureId,
            };
            return { ...chapter, chapterContent: updatedContent };
          } else {
            // Add new lecture
            const newLecture = {
              ...lectureDetails,
              lectureOrder: chapter.chapterContent.length > 0 ? 
                Math.max(...chapter.chapterContent.map(lec => lec.lectureOrder || 0)) + 1 : 1,
              lectureId: uniqid()
            };
            return { ...chapter, chapterContent: [...chapter.chapterContent, newLecture] };
          }
        }
        return chapter;
      })
    );
    setShowPopup(false);
    setEditingLecture(null);
    setLectureDetails({
      lectureTitle: '',
      lectureDuration: '',
      lectureUrl: '',
      isPreviewFree: false,
    });
  };

  const handleSubmit = async (e) => {
    try {
      e.preventDefault();

      const courseData = {
        courseTitle,
        courseDescription: quillRef.current.root.innerHTML,
        coursePrice: Number(coursePrice),
        discount: Number(discount),
        courseContent: chapters,
      }

      const formData = new FormData()
      formData.append('courseData', JSON.stringify(courseData))
      if (image) {
        formData.append('image', image)
      }

      const token = await getToken()

      const { data } = await axios.put(
        `${backendUrl}/api/educator/course/${courseId}`, 
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (data.success) {
        toast.success(data.message)
        navigate('/educator/my-courses')
      } else {
        toast.error(data.message)
      }

    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update course')
    }
  };

  useEffect(() => {
    // Initialize Quill only once
    if (!quillRef.current && editorRef.current) {
      quillRef.current = new Quill(editorRef.current, {
        theme: 'snow',
      });
    }
  }, []);

  // Set description after Quill is initialized and course data is loaded
  useEffect(() => {
    if (quillRef.current && !loading && courseTitle) {
      // Find the course data and set description
      const fetchAndSetDescription = async () => {
        try {
          const token = await getToken();
          const { data } = await axios.get(
            `${backendUrl}/api/educator/course/${courseId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (data.success && quillRef.current) {
            quillRef.current.root.innerHTML = data.course.courseDescription || '';
          }
        } catch (error) {
          console.error('Error setting description:', error);
        }
      };
      fetchAndSetDescription();
    }
  }, [quillRef.current, loading, courseTitle]);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className='min-h-screen overflow-auto md:p-8 p-4'>
      <div className='flex items-center gap-2 mb-6'>
        <button
          onClick={() => navigate('/educator/my-courses')}
          className='text-blue-500 hover:text-blue-600'
        >
          ← Back to My Courses
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className='flex flex-col gap-4 max-w-md w-full text-gray-500'>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Edit Course</h2>
        
        <div className='flex flex-col gap-1'>
          <p>Course Title</p>
          <input 
            onChange={e => setCourseTitle(e.target.value)} 
            value={courseTitle} 
            type="text" 
            placeholder='Type here' 
            className='outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500' 
            required 
          />
        </div>

        <div className='flex flex-col gap-1'>
          <p>Course Description</p>
          <div ref={editorRef}></div>
        </div>

        <div className='flex items-center justify-between flex-wrap'>
          <div className='flex flex-col gap-1'>
            <p>Course Price</p>
            <input 
              onChange={e => setCoursePrice(e.target.value)} 
              value={coursePrice} 
              type="number" 
              placeholder='0' 
              className='outline-none md:py-2.5 py-2 w-28 px-3 rounded border border-gray-500' 
              required 
            />
          </div>

          <div className='flex md:flex-row flex-col items-center gap-3'>
            <p>Course Thumbnail</p>
            <label htmlFor='thumbnailImage' className='flex items-center gap-3'>
              <img src={assets.file_upload_icon} alt="" className='p-3 bg-blue-500 rounded' />
              <input 
                type="file" 
                id='thumbnailImage' 
                onChange={e => setImage(e.target.files[0])} 
                accept="image/*" 
                hidden 
              />
              <img 
                className='max-h-10' 
                src={image ? URL.createObjectURL(image) : existingImageUrl} 
                alt="" 
              />
            </label>
          </div>
        </div>

        <div className='flex flex-col gap-1'>
          <p>Discount %</p>
          <input 
            onChange={e => setDiscount(e.target.value)} 
            value={discount} 
            type="number" 
            placeholder='0' 
            min={0} 
            max={100} 
            className='outline-none md:py-2.5 py-2 w-28 px-3 rounded border border-gray-500' 
            required 
          />
        </div>

        {/* Chapters & Lectures */}
        <div>
          {chapters.map((chapter, chapterIndex) => (
            <div key={chapter.chapterId || chapterIndex} className="bg-white border rounded-lg mb-4">
              <div className="flex justify-between items-center p-4 border-b">
                <div className="flex items-center">
                  <img 
                    className={`mr-2 cursor-pointer transition-all ${chapter.collapsed && "-rotate-90"} `} 
                    onClick={() => handleChapter('toggle', chapter.chapterId)} 
                    src={assets.dropdown_icon} 
                    width={14} 
                    alt="" 
                  />
                  <span className="font-semibold">{chapterIndex + 1} {chapter.chapterTitle}</span>
                </div>
                <span className="text-gray-500">{chapter.chapterContent?.length || 0} Lectures</span>
                <img 
                  onClick={() => handleChapter('remove', chapter.chapterId)} 
                  src={assets.cross_icon} 
                  alt="" 
                  className='cursor-pointer' 
                />
              </div>
              {!chapter.collapsed && (
                <div className="p-4">
                  {chapter.chapterContent?.map((lecture, lectureIndex) => (
                    <div key={lecture.lectureId || lectureIndex} className="flex justify-between items-center mb-2">
                      <span>{lectureIndex + 1} {lecture.lectureTitle} - {lecture.lectureDuration} mins - <a href={lecture.lectureUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500">Link</a> - {lecture.isPreviewFree ? 'Free Preview' : 'Paid'}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleLecture('edit', chapter.chapterId, lectureIndex)}
                          className="text-blue-500 hover:text-blue-600 text-xs"
                        >
                          Edit
                        </button>
                        <img 
                          onClick={() => handleLecture('remove', chapter.chapterId, lectureIndex)} 
                          src={assets.cross_icon} 
                          alt="" 
                          className='cursor-pointer' 
                        />
                      </div>
                    </div>
                  ))}
                  <div className="inline-flex bg-gray-100 p-2 rounded cursor-pointer mt-2" onClick={() => handleLecture('add', chapter.chapterId)}>
                    + Add Lecture
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-center items-center bg-blue-100 p-2 rounded-lg cursor-pointer" onClick={() => handleChapter('add')}>
            + Add Chapter
          </div>

          {showPopup && (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
              <div className="bg-white text-gray-700 p-4 rounded relative w-full max-w-80">
                <h2 className="text-lg font-semibold mb-4">
                  {editingLecture ? 'Edit Lecture' : 'Add Lecture'}
                </h2>
                <div className="mb-2">
                  <p>Lecture Title</p>
                  <input
                    type="text"
                    className="mt-1 block w-full border rounded py-1 px-2"
                    value={lectureDetails.lectureTitle}
                    onChange={(e) => setLectureDetails({ ...lectureDetails, lectureTitle: e.target.value })}
                  />
                </div>
                <div className="mb-2">
                  <p>Duration (minutes)</p>
                  <input
                    type="number"
                    className="mt-1 block w-full border rounded py-1 px-2"
                    value={lectureDetails.lectureDuration}
                    onChange={(e) => setLectureDetails({ ...lectureDetails, lectureDuration: e.target.value })}
                  />
                </div>
                <div className="mb-2">
                  <p>Lecture URL</p>
                  <input
                    type="text"
                    className="mt-1 block w-full border rounded py-1 px-2"
                    value={lectureDetails.lectureUrl}
                    onChange={(e) => setLectureDetails({ ...lectureDetails, lectureUrl: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 my-4">
                  <p>Is Preview Free?</p>
                  <input
                    type="checkbox" 
                    className='mt-1 scale-125'
                    checked={lectureDetails.isPreviewFree}
                    onChange={(e) => setLectureDetails({ ...lectureDetails, isPreviewFree: e.target.checked })}
                  />
                </div>
                <button 
                  type='button' 
                  className="w-full bg-blue-400 text-white px-4 py-2 rounded" 
                  onClick={addOrUpdateLecture}
                >
                  {editingLecture ? 'Update' : 'Add'}
                </button>
                <img 
                  onClick={() => setShowPopup(false)} 
                  src={assets.cross_icon} 
                  className='absolute top-4 right-4 w-4 cursor-pointer' 
                  alt="" 
                />
              </div>
            </div>
          )}
        </div>

        <button type="submit" className='bg-blue-500 hover:bg-blue-600 text-white w-max py-2.5 px-8 rounded my-4'>
          UPDATE COURSE
        </button>
      </form>
    </div>
  );
};

export default EditCourse;